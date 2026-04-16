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
      input.ai_model,
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
    if (!balance || Number(balance.amount) < price.total) {
      return NextResponse.json(
        { error: { code: 'INSUFFICIENT_BALANCE', message: `Недостаточно токенов. Нужно: ${price.total}, доступно: ${Number(balance?.amount ?? 0)}`, statusCode: 402 } },
        { status: 402 },
      );
    }

    await prisma.balance.update({
      where: { userId: session.user.id },
      data: { amount: { decrement: price.total } },
    });

    const jobStep = await prisma.jobStep.create({
      data: {
        status: 'processing',
        stepIndex: 0,
        stepName: 'moderation',
        toolId: tool.id,
        userId: session.user.id,
        input: input as any,
      },
    });

    const config = tool.config as Record<string, unknown> | null;
    runPipeline(jobStep.id, session.user.id, input as any, config, seoExpressSteps)
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
