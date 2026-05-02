import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { regeneratePipeline } from '@/modules/seo/pipeline';
import { seoExpressSteps } from '@/modules/seo/steps';
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
    const { brief, savedImages } = await req.json();

    const job = await prisma.jobStep.findUnique({ where: { id } });
    if (!job || job.userId !== session.user.id) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Job not found', statusCode: 404 } },
        { status: 404 },
      );
    }

    const jobInput = job.input as Record<string, unknown>;
    const fullCost = (jobInput.fullCost as number) ?? 0;
    const idempotencyKey = `seo-regenerate:${session.user.id}:${id}:${Date.now()}`;

    try {
      await prisma.$transaction(async (tx) => {
        await reserveTokens(session.user.id, fullCost, idempotencyKey, tx);
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: { code: 'INSUFFICIENT_BALANCE', message: `Недостаточно токенов для перегенерации. Нужно: ${fullCost}`, statusCode: 402 } },
          { status: 402 },
        );
      }
      throw err;
    }

    const tool = await ToolRegistry.resolve('seo-article-express');
    const config = tool?.config as Record<string, unknown> | null;

    regeneratePipeline(
      id,
      session.user.id,
      brief,
      savedImages ?? null,
      config,
      seoExpressSteps,
      fullCost,
    ).catch(err => console.error('[seo-express] Regenerate pipeline error:', err));

    return NextResponse.json({ data: { success: true, jobId: id } });
  } catch (e) {
    return apiError(e, 'POST /api/jobs/[id]/regenerate');
  }
}
