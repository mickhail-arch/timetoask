// app/api/jobs/[id]/confirm/route.ts — подтверждение ТЗ
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { getRedisState, resumePipeline } from '@/modules/seo/pipeline';
import { seoExpressSteps, RESUME_FROM_INDEX } from '@/modules/seo/steps';
import { ToolRegistry } from '@/plugins/registry';
import { prisma } from '@/lib/prisma';
import { reserveTokens } from '@/modules/billing/billing.service';
import { InsufficientBalanceError } from '@/core/errors';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  const { id } = await params;

  try {
    const { brief, user_edited } = await req.json();

    const state = await getRedisState(id);
    if (!state || state.status !== 'awaiting_confirmation') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: 'Job is not awaiting confirmation', statusCode: 400 } },
        { status: 400 },
      );
    }

    const jobStep = await prisma.jobStep.findUnique({ where: { id } });
    if (!jobStep) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Job not found', statusCode: 404 } },
        { status: 404 },
      );
    }
    const jobInput = jobStep.input as Record<string, unknown>;
    const analysisCost = (jobInput.analysisCost as number) ?? 0;
    const fullCost = (jobInput.fullCost as number) ?? 0;
    const remainingCost = Math.max(0, fullCost - analysisCost);

    const idempotencyKey = `seo-remaining:${session.user.id}:${id}`;
    try {
      await prisma.$transaction(async (tx) => {
        await reserveTokens(session.user.id, remainingCost, idempotencyKey, tx);
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: { code: 'INSUFFICIENT_BALANCE', message: `Недостаточно токенов для продолжения. Нужно: ${remainingCost}`, statusCode: 402 } },
          { status: 402 },
        );
      }
      throw err;
    }

    // Получить config из tool
    const tool = await ToolRegistry.resolve('seo-article-express');
    const config = tool?.config as Record<string, unknown> | null;

    // Запустить resume асинхронно
    resumePipeline(
      id,
      session.user.id,
      { ...brief, user_edited: user_edited ?? false },
      config,
      seoExpressSteps,
      RESUME_FROM_INDEX,
      remainingCost,
    ).catch(err => console.error('[seo-express] Resume pipeline error:', err));

    return NextResponse.json({ data: { success: true, jobId: id } });
  } catch (e) {
    return apiError(e, 'POST /api/jobs/[id]/confirm');
  }
}
