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
import { reserveTokens } from '@/modules/billing/billing.service';
import { InsufficientBalanceError } from '@/core/errors';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const parsed = inputSchema.safeParse(body.input);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 } },
        { status: 400 },
      );
    }

    const input = parsed.data;

    const tool = await ToolRegistry.resolve('seo-article-express');
    if (!tool) {
      return NextResponse.json(
        { error: { code: 'TOOL_NOT_FOUND', message: 'Tool seo-article-express not found', statusCode: 404 } },
        { status: 404 },
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: { code: 'USER_NOT_FOUND', message: 'User not found', statusCode: 404 } },
        { status: 404 },
      );
    }

    const balance = await prisma.balance.findUnique({
      where: { userId: session.user.id },
    });

    const jobStep = await prisma.jobStep.create({
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
        } as any,
      },
    });

    const idempotencyKey = `seo-analysis:${session.user.id}:${jobStep.id}`;

    try {
      await prisma.$transaction(async (tx) => {
        await reserveTokens(session.user.id, price.analysisCost, idempotencyKey, tx);
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      await prisma.jobStep.delete({ where: { id: jobStep.id } });
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: { code: 'INSUFFICIENT_BALANCE', message: `Недостаточно токенов. Нужно: ${price.analysisCost}, доступно: ${Number(balance?.amount ?? 0)}`, statusCode: 402 } },
          { status: 402 },
        );
      }
      throw err;
    }

    await prisma.jobStep.update({
      where: { id: jobStep.id },
      data: { status: 'processing' },
    });

    const config = tool.config as Record<string, unknown> | null;
    runPipeline(jobStep.id, session.user.id, input as any, config, seoExpressSteps, price.analysisCost)
      .catch(err => console.error('[seo-express] Pipeline fatal error:', err));

    return NextResponse.json({
      data: {
        jobId: jobStep.id,
        calculatedPrice: price.total,
        priceBreakdown: price,
      },
    });
  } catch (e) {
    return apiError(e, 'POST /api/tools/seo-article-express/execute');
  }
}
