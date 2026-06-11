// app/api/jobs/[id]/status/route.ts — статус job с поддержкой SEO-пайплайна
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getJobStatus } from '@/modules/llm/tool-execution.service';
import { getRedisState, saveRedisState } from '@/modules/seo/pipeline';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  const { id } = await params;

  try {
    const job = await prisma.jobStep.findUnique({ where: { id }, select: { userId: true, status: true, output: true, input: true } });
    if (!job || job.userId !== session.user.id) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Job not found', statusCode: 404 } },
        { status: 404 },
      );
    }

    const redisState = await getRedisState(id);
    if (redisState) {
      return NextResponse.json({ data: redisState });
    }

    if (job.status === 'awaiting_confirmation') {
      const output = job.output as Record<string, unknown> | null;
      if (output?.brief) {
        const restored: Parameters<typeof saveRedisState>[1] = {
          jobId: id,
          status: 'awaiting_confirmation',
          currentStep: 2,
          totalSteps: 11,
          stepName: 'Формирование ТЗ',
          progress: 15,
          brief: output.brief as import('@/modules/seo/types').BriefData,
          calculatedPrice: output.calculatedPrice as number | undefined,
          originalInput: job.input as Record<string, unknown>,
        };
        await saveRedisState(id, restored);
        return NextResponse.json({ data: restored });
      }
    }

    // Fallback на стандартный PG job status
    const data = await getJobStatus(id, session.user.id);
    return NextResponse.json({ data });
  } catch (e) {
    return apiError(e, 'GET /api/jobs/[id]/status');
  }
}
