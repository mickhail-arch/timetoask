//app/api/tools/seo-article-express/execute/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { inputSchema } from '@/plugins/seo-article-express/schema';
import { calculatePrice } from '@/modules/seo/pricing';
import { runPipeline } from '@/modules/seo/pipeline';
import { seoExpressSteps } from '@/modules/seo/steps';
import { ToolRegistry } from '@/plugins/registry';
import { env } from '@/core/config/env';
import { reserveTokens } from '@/modules/billing/billing.service';
import { acquireIdempotency, releaseIdempotency } from '@/lib/idempotency';
import { createHash } from 'node:crypto';
import { InsufficientBalanceError, DuplicateRequestError } from '@/core/errors';
import type { Prisma } from '@/generated/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const parsed = inputSchema.safeParse(body.input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const message = first?.message ?? 'Проверьте правильность заполнения полей';
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message, statusCode: 400 } },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const sessionIdFromClient = (body.sessionId as string | undefined) ?? null;

    const tool = await ToolRegistry.resolve('seo-article-express');
    if (!tool) {
      return NextResponse.json(
        { error: { code: 'TOOL_NOT_FOUND', message: 'Tool seo-article-express not found', statusCode: 404 } },
        { status: 404 },
      );
    }

    const [userActive, globalActive] = await Promise.all([
      prisma.jobStep.count({
        where: { userId: session.user.id, status: { in: ['pending', 'processing'] }, parentId: null },
      }),
      prisma.jobStep.count({
        where: { status: { in: ['pending', 'processing'] }, parentId: null },
      }),
    ]);
    if (userActive >= env.MAX_CONCURRENT_ASYNC) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_REQUESTS', message: 'У вас уже выполняется максимум задач. Дождитесь завершения текущих', statusCode: 429 } },
        { status: 429 },
      );
    }
    if (globalActive >= env.MAX_CONCURRENT_GLOBAL) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_REQUESTS', message: 'Сервис сейчас перегружен. Попробуйте через пару минут', statusCode: 429 } },
        { status: 429 },
      );
    }

    const pricingConfig = (tool.config as Record<string, unknown>)?.pricing as Record<string, unknown> | undefined;
    const price = calculatePrice(
      input.target_char_count,
      input.image_count,
      input.faq_count,
      pricingConfig as any,
      input.ai_model ?? 'opus47',
      input.analysis_model ?? 'sonnet',
    );

    const balance = await prisma.balance.findUnique({
      where: { userId: session.user.id },
    });

    const dedupeKey = `seo-execute:${session.user.id}:${createHash('sha1')
      .update(JSON.stringify(input))
      .digest('hex')
      .slice(0, 16)}`;
    const fresh = await acquireIdempotency(dedupeKey);
    if (!fresh) throw new DuplicateRequestError();

    // Атомарно: создать JobStep + создать/обновить ToolSession + зарезервировать токены
    type AtomicResult = { jobId: string; sessionId: string };
    let atomicResult: AtomicResult;
    try {
      atomicResult = await prisma.$transaction(async (tx) => {
        const jobStep = await tx.jobStep.create({
          data: {
            status: 'pending',
            stepIndex: 0,
            stepName: 'moderation',
            toolId: tool.id,
            userId: session.user.id,
            input: {
              ...input,
              analysisCost: price.analysisCost,
              fullCost: price.total,
            } as Prisma.InputJsonValue,
          },
        });

        const title = (input.target_query as string) ?? 'Без названия';
        const outputMeta = { jobId: jobStep.id, price: price.total } as Prisma.InputJsonValue;

        let toolSession;
        if (sessionIdFromClient) {
          // Подключаемся к существующей draft-сессии: проверяем, что она наша и пишем jobId
          const existing = await tx.toolSession.findUnique({
            where: { id: sessionIdFromClient },
            select: { id: true, userId: true },
          });
          if (existing && existing.userId === session.user.id) {
            toolSession = await tx.toolSession.update({
              where: { id: sessionIdFromClient },
              data: {
                status: 'generating',
                title,
                inputParams: input as Prisma.InputJsonValue,
                outputMeta,
              },
            });
          } else {
            // sessionId невалиден — создаём новую
            toolSession = await tx.toolSession.create({
              data: {
                userId: session.user.id,
                toolId: tool.id,
                title,
                status: 'generating',
                inputParams: input as Prisma.InputJsonValue,
                outputMeta,
                contentText: null,
                tokensUsed: 0,
                durationSec: 0,
                version: 1,
              },
            });
          }
        } else {
          toolSession = await tx.toolSession.create({
            data: {
              userId: session.user.id,
              toolId: tool.id,
              title,
              status: 'generating',
              inputParams: input as Prisma.InputJsonValue,
              outputMeta,
              contentText: null,
              tokensUsed: 0,
              durationSec: 0,
              version: 1,
            },
          });
        }

        const idempotencyKey = `seo-analysis:${session.user.id}:${jobStep.id}`;
        await reserveTokens(session.user.id, price.analysisCost, idempotencyKey, tx);

        await tx.jobStep.update({
          where: { id: jobStep.id },
          data: { status: 'processing' },
        });

        return { jobId: jobStep.id, sessionId: toolSession.id };
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      await releaseIdempotency(dedupeKey);
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: { code: 'INSUFFICIENT_BALANCE', message: `Недостаточно токенов. Нужно: ${price.analysisCost}, доступно: ${Number(balance?.amount ?? 0)}`, statusCode: 402 } },
          { status: 402 },
        );
      }
      throw err;
    }

    const config = tool.config as Record<string, unknown> | null;
    runPipeline(atomicResult.jobId, session.user.id, input as any, config, seoExpressSteps, price.analysisCost, atomicResult.sessionId)
      .catch(err => console.error('[seo-express] Pipeline fatal error:', err));

    return NextResponse.json({
      data: {
        jobId: atomicResult.jobId,
        sessionId: atomicResult.sessionId,
        calculatedPrice: price.total,
        priceBreakdown: price,
      },
    });
  } catch (e) {
    return apiError(e, 'POST /api/tools/seo-article-express/execute');
  }
}
