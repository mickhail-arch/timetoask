// modules/seo/pipeline.ts — SEO pipeline runner
import * as Sentry from '@sentry/nextjs';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import type {
  StepDefinition,
  StepResult,
  PipelineContext,
  PipelineState,
  BriefData,
} from './types';
import { calculatePrice } from './pricing';
import type { PricingConfig } from './pricing';
import { finalizeTokens, rollbackTokens } from '@/modules/billing/billing.service';

const REDIS_TTL = 7200; // 2 часа
const redisKey = (jobId: string) => `seo:job:${jobId}`;
const cancelKey = (jobId: string) => `seo:cancel:${jobId}`;

async function isCancelled(jobId: string): Promise<boolean> {
  return (await redis.exists(cancelKey(jobId))) === 1;
}

const STEP_PROGRESS: Record<string, [number, number]> = {
  'moderation': [0, 5],
  'research': [5, 10],
  'brief': [10, 15],
  'confirmation': [15, 15],
  'moderation_headings': [15, 20],
  'draft': [20, 50],
  'seo_audit': [50, 55],
  'content_analysis': [55, 65],
  'ai_detect_revisions': [65, 78],
  'targeted_rewrite': [78, 90],
  'images': [90, 97],
  'assembly': [97, 100],
};

async function syncSessionStatus(
  jobId: string,
  status: 'generating' | 'awaiting_confirmation' | 'completed' | 'failed',
  extra?: { contentText?: string; outputMeta?: Record<string, unknown> },
) {
  try {
    // Поиск 1: по outputMeta.jobId (нормальный путь после атомарного execute)
    let sessions = await prisma.toolSession.findMany({
      where: { outputMeta: { path: ['jobId'], equals: jobId } },
      select: { id: true, outputMeta: true, userId: true },
    });

    // Поиск 2 (fallback): берём userId+createdAt из JobStep и ищем самую свежую generating-сессию того же пользователя
    if (sessions.length === 0) {
      const job = await prisma.jobStep.findUnique({
        where: { id: jobId },
        select: { userId: true, createdAt: true },
      });
      if (job) {
        const cutoffMs = 60_000;
        const startWindow = new Date(job.createdAt.getTime() - cutoffMs);
        const endWindow = new Date(job.createdAt.getTime() + cutoffMs);
        const candidate = await prisma.toolSession.findFirst({
          where: {
            userId: job.userId,
            status: { in: ['generating', 'awaiting_confirmation'] },
            createdAt: { gte: startWindow, lte: endWindow },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, outputMeta: true, userId: true },
        });
        if (candidate) {
          sessions = [candidate];
          // Backfill jobId в outputMeta, чтобы будущие sync-и нашли её прямым путём
          const currentMeta = (candidate.outputMeta as Record<string, unknown> | null) ?? {};
          await prisma.toolSession.update({
            where: { id: candidate.id },
            data: {
              outputMeta: { ...currentMeta, jobId } as Prisma.InputJsonValue,
            },
          });
          console.warn(`[pipeline] syncSessionStatus: backfilled jobId for orphan session ${candidate.id} (jobId=${jobId})`);
        }
      }
    }

    if (sessions.length === 0) {
      console.warn(`[pipeline] syncSessionStatus: no session found for jobId=${jobId}`);
      return;
    }

    for (const s of sessions) {
      const currentMeta = (s.outputMeta as Record<string, unknown> | null) ?? {};
      await prisma.toolSession.update({
        where: { id: s.id },
        data: {
          status,
          ...(extra?.contentText ? { contentText: extra.contentText } : {}),
          ...(extra?.outputMeta ? { outputMeta: { ...currentMeta, ...extra.outputMeta } as Prisma.InputJsonValue } : {}),
        },
      });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'seo-pipeline-sync' } });
    console.warn('[pipeline] syncSessionStatus failed:', err);
  }
}

export async function saveRedisState(jobId: string, state: Partial<PipelineState>): Promise<void> {
  await redis.setex(redisKey(jobId), REDIS_TTL, JSON.stringify(state));
}

export async function deleteRedisState(jobId: string): Promise<void> {
  await redis.del(redisKey(jobId));
}

export async function cancelJob(jobId: string, userId: string): Promise<void> {
  const job = await prisma.jobStep.findUnique({ where: { id: jobId }, select: { userId: true } });
  if (!job || job.userId !== userId) return;
  await redis.setex(cancelKey(jobId), 7200, '1');
  await redis.del(redisKey(jobId));
  await prisma.jobStep.update({ where: { id: jobId }, data: { status: 'failed', error: 'Отменено пользователем', endedAt: new Date() } });
  await syncSessionStatus(jobId, 'failed');
}

export async function getRedisState(jobId: string): Promise<PipelineState | null> {
  const raw = await redis.get(redisKey(jobId));
  if (!raw) return null;
  return JSON.parse(raw) as PipelineState;
}

async function resolveSessionId(jobId: string): Promise<string | undefined> {
  const s = await prisma.toolSession.findFirst({
    where: { outputMeta: { path: ['jobId'], equals: jobId } },
    select: { id: true },
  });
  return s?.id;
}

async function updateJobStep(
  jobId: string,
  data: {
    status?: string;
    stepIndex?: number;
    stepName?: string;
    output?: Prisma.JsonObject;
    error?: string;
    startedAt?: Date;
    endedAt?: Date;
  },
): Promise<void> {
  await prisma.jobStep.update({
    where: { id: jobId },
    data,
  });
}

/**
 * Запуск пайплайна.
 * Вызывается из route handler после создания jobStep в PG.
 */
export async function runPipeline(
  jobId: string,
  userId: string,
  input: Record<string, unknown>,
  config: Record<string, unknown> | null,
  steps: StepDefinition[],
  analysisCost: number,
  sessionId?: string,
): Promise<void> {
  const ctx: PipelineContext = {
    jobId,
    userId,
    sessionId: sessionId ?? (await resolveSessionId(jobId)),
    input,
    config,
    data: {},
  };

  await updateJobStep(jobId, {
    status: 'processing',
    startedAt: new Date(),
  });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const progressRange = STEP_PROGRESS[step.name] ?? [0, 100];

    await saveRedisState(jobId, {
      jobId,
      status: 'processing',
      currentStep: i,
      totalSteps: steps.length,
      stepName: step.displayName,
      progress: progressRange[0],
    });

    await updateJobStep(jobId, {
      stepIndex: i,
      output: {
        currentStep: i,
        totalSteps: steps.length,
        stepName: step.name,
      } as Prisma.JsonObject,
    });

    try {
      if (await isCancelled(jobId)) throw new Error('Отменено пользователем');
      const result = await step.execute(ctx);

      ctx.data[step.name] = result.data;

      if (result.requiresConfirmation) {
        const pricingConfig = (config as Record<string, unknown>)?.pricing as
          | Partial<PricingConfig>
          | undefined;
        const brief = result.data as unknown as BriefData;
        const charCount = (input.target_char_count as number) ?? 8000;
        const imageCount = (input.image_count as number) ?? 0;
        const faqCount = (input.faq_count as number) ?? 5;
        const price = calculatePrice(charCount, imageCount, faqCount, pricingConfig, (input.ai_model as string) ?? 'opus47', (input.analysis_model as string) ?? 'sonnet');

        await saveRedisState(jobId, {
          jobId,
          status: 'awaiting_confirmation',
          currentStep: i,
          totalSteps: steps.length,
          stepName: step.displayName,
          progress: progressRange[1],
          brief,
          calculatedPrice: price.total,
          priceBreakdown: price,
          originalInput: input,
          competitorMeta: ctx.data.competitorMeta ?? [],
        });

        await updateJobStep(jobId, {
          status: 'awaiting_confirmation',
          output: {
            brief,
            calculatedPrice: price.total,
          } as unknown as Prisma.JsonObject,
        });

        await prisma.$transaction(async (tx) => {
          await finalizeTokens(userId, analysisCost, tx, `seo-analysis:${userId}:${jobId}`);
        }, { isolationLevel: 'Serializable' });

        await syncSessionStatus(jobId, 'awaiting_confirmation');

        return;
      }

      await saveRedisState(jobId, {
        jobId,
        status: 'processing',
        currentStep: i,
        totalSteps: steps.length,
        stepName: step.displayName,
        progress: progressRange[1],
        partialData: typeof result.data?.partial === 'string'
          ? result.data.partial as string
          : undefined,
        qualityMetrics: result.data?.qualityMetrics as PipelineState['qualityMetrics'],
        warnings: result.data?.warnings as string[],
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { area: 'seo-pipeline', jobId } });
      const message = err instanceof Error ? err.message : String(err);

      await saveRedisState(jobId, {
        jobId,
        status: 'failed',
        currentStep: i,
        totalSteps: steps.length,
        stepName: step.displayName,
        progress: progressRange[0],
        error: message,
        failedStep: step.name,
      });

      await updateJobStep(jobId, {
        status: 'failed',
        error: `Step "${step.name}" (${i + 1}/${steps.length}) failed: ${message}`,
        endedAt: new Date(),
      });

      if (i <= 2) {
        await prisma.$transaction(async (tx) => {
          await rollbackTokens(userId, analysisCost, tx, `seo-analysis:${userId}:${jobId}`);
        }, { isolationLevel: 'Serializable' });
      }

      await syncSessionStatus(jobId, 'failed');

      return;
    }
  }

  await saveRedisState(jobId, {
    jobId,
    status: 'completed',
    currentStep: steps.length - 1,
    totalSteps: steps.length,
    stepName: 'done',
    progress: 100,
    result: ctx.data,
  });

  await updateJobStep(jobId, {
    status: 'completed',
    output: ctx.data as unknown as Prisma.JsonObject,
    endedAt: new Date(),
  });
}

/**
 * Продолжить пайплайн после подтверждения ТЗ.
 * Читает состояние из Redis, продолжает с шага после confirmation.
 */
export async function resumePipeline(
  jobId: string,
  userId: string,
  updatedBrief: BriefData,
  config: Record<string, unknown> | null,
  steps: StepDefinition[],
  resumeFromIndex: number,
  remainingCost: number,
): Promise<void> {
  const state = await getRedisState(jobId);
  if (!state) {
    await prisma.$transaction(async (tx) => {
      await rollbackTokens(userId, remainingCost, tx, `seo-remaining:${userId}:${jobId}`);
    }, { isolationLevel: 'Serializable' });
    throw new Error('Job state not found in Redis');
  }

  // Сразу помечаем processing в Redis, чтобы polling увидел переход без задержки.
  // originalInput/result уже считаны в локальный state и далее берутся из него.
  const firstStep = steps[resumeFromIndex];
  await saveRedisState(jobId, {
    jobId,
    status: 'processing',
    currentStep: resumeFromIndex,
    totalSteps: steps.length,
    stepName: firstStep?.displayName ?? 'Генерация',
    progress: STEP_PROGRESS[firstStep?.name ?? '']?.[0] ?? 15,
    originalInput: state.originalInput,
  });

  await syncSessionStatus(jobId, 'generating');

  const ctx: PipelineContext = {
    jobId,
    userId,
    sessionId: await resolveSessionId(jobId),
    input: state.originalInput ?? state.result ?? {},
    config,
    data: { ...state.result, confirmation: { brief: updatedBrief, user_edited: true } },
  };

  const remainingSteps = steps.slice(resumeFromIndex);

  await updateJobStep(jobId, {
    status: 'processing',
    startedAt: new Date(),
  });

  for (let i = 0; i < remainingSteps.length; i++) {
    const globalIndex = resumeFromIndex + i;
    const step = remainingSteps[i];
    const progressRange = STEP_PROGRESS[step.name] ?? [0, 100];

    await saveRedisState(jobId, {
      jobId,
      status: 'processing',
      currentStep: globalIndex,
      totalSteps: steps.length,
      stepName: step.displayName,
      progress: progressRange[0],
    });

    await updateJobStep(jobId, {
      stepIndex: globalIndex,
    });

    try {
      if (await isCancelled(jobId)) throw new Error('Отменено пользователем');
      const result = await step.execute(ctx);
      ctx.data[step.name] = result.data;

      await saveRedisState(jobId, {
        jobId,
        status: 'processing',
        currentStep: globalIndex,
        totalSteps: steps.length,
        stepName: step.displayName,
        progress: progressRange[1],
        partialData: typeof result.data?.partial === 'string'
          ? result.data.partial as string
          : undefined,
        qualityMetrics: result.data?.qualityMetrics as PipelineState['qualityMetrics'],
        warnings: result.data?.warnings as string[],
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { area: 'seo-pipeline', jobId } });
      const message = err instanceof Error ? err.message : String(err);

      await saveRedisState(jobId, {
        jobId,
        status: 'failed',
        currentStep: globalIndex,
        totalSteps: steps.length,
        stepName: step.displayName,
        progress: progressRange[0],
        error: message,
        failedStep: step.name,
      });

      await updateJobStep(jobId, {
        status: 'failed',
        error: `Step "${step.name}" (${globalIndex + 1}/${steps.length}) failed: ${message}`,
        endedAt: new Date(),
      });

      await prisma.$transaction(async (tx) => {
        await rollbackTokens(userId, remainingCost, tx, `seo-remaining:${userId}:${jobId}`);
      }, { isolationLevel: 'Serializable' });

      await syncSessionStatus(jobId, 'failed');

      return;
    }
  }

  await prisma.$transaction(async (tx) => {
    await finalizeTokens(userId, remainingCost, tx, `seo-remaining:${userId}:${jobId}`);
  }, { isolationLevel: 'Serializable' });

  const finalHtml = (ctx.data.assembly as Record<string, unknown>)?.article_html as string | undefined;
  const finalMeta = ctx.data.assembly as Record<string, unknown> | undefined;
  await syncSessionStatus(jobId, 'completed', {
    contentText: finalHtml,
    outputMeta: {
      metadata: finalMeta?.metadata,
      quality_metrics: finalMeta?.qualityMetrics,
    },
  });

  await saveRedisState(jobId, {
    jobId,
    status: 'completed',
    currentStep: steps.length - 1,
    totalSteps: steps.length,
    stepName: 'done',
    progress: 100,
    result: ctx.data,
  });

  await updateJobStep(jobId, {
    status: 'completed',
    output: ctx.data as unknown as Prisma.JsonObject,
    endedAt: new Date(),
  });
}

/**
 * Перегенерация статьи с тем же brief и input.
 * Запускает шаги: moderation_headings → draft → seo_audit → content_analysis → ai_detect_revisions → targeted_rewrite → assembly.
 * Пропускает images — использует savedImages из предыдущего результата.
 */
export async function regeneratePipeline(
  jobId: string,
  userId: string,
  brief: BriefData,
  savedImages: Record<string, unknown> | null,
  config: Record<string, unknown> | null,
  steps: StepDefinition[],
  regenerateCost: number,
): Promise<void> {
  const state = await getRedisState(jobId);
  if (!state) {
    await prisma.$transaction(async (tx) => {
      await rollbackTokens(userId, regenerateCost, tx, `seo-regenerate:${userId}:${jobId}`);
    }, { isolationLevel: 'Serializable' });
    throw new Error('Job state not found in Redis');
  }

  const ctx: PipelineContext = {
    jobId,
    userId,
    sessionId: await resolveSessionId(jobId),
    input: state.originalInput ?? {},
    config,
    data: {
      confirmation: { brief, user_edited: false },
      ...(savedImages ? { images: savedImages } : {}),
    },
  };

  const regenStepNames = savedImages
    ? ['moderation_headings', 'draft', 'seo_audit', 'content_analysis', 'ai_detect_revisions', 'targeted_rewrite', 'assembly']
    : ['moderation_headings', 'draft', 'seo_audit', 'content_analysis', 'ai_detect_revisions', 'targeted_rewrite', 'images', 'assembly'];

  const regenSteps = steps.filter(s => regenStepNames.includes(s.name));

  await updateJobStep(jobId, {
    status: 'processing',
    startedAt: new Date(),
  });

  for (let i = 0; i < regenSteps.length; i++) {
    const step = regenSteps[i];
    const progressRange = STEP_PROGRESS[step.name] ?? [0, 100];

    await saveRedisState(jobId, {
      jobId,
      status: 'processing',
      currentStep: i + 2,
      totalSteps: steps.length,
      stepName: step.displayName,
      progress: progressRange[0],
    });

    try {
      if (await isCancelled(jobId)) throw new Error('Отменено пользователем');
      const result = await step.execute(ctx);
      ctx.data[step.name] = result.data;

      await saveRedisState(jobId, {
        jobId,
        status: 'processing',
        currentStep: i + 2,
        totalSteps: steps.length,
        stepName: step.displayName,
        progress: progressRange[1],
        partialData: typeof result.data?.partial === 'string'
          ? result.data.partial as string
          : undefined,
        qualityMetrics: result.data?.qualityMetrics as PipelineState['qualityMetrics'],
        warnings: result.data?.warnings as string[],
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { area: 'seo-pipeline', jobId } });
      const message = err instanceof Error ? err.message : String(err);
      await saveRedisState(jobId, {
        jobId,
        status: 'failed',
        currentStep: i + 2,
        totalSteps: steps.length,
        stepName: step.displayName,
        progress: progressRange[0],
        error: message,
        failedStep: step.name,
      });
      await updateJobStep(jobId, {
        status: 'failed',
        error: `Regenerate step "${step.name}" failed: ${message}`,
        endedAt: new Date(),
      });
      await prisma.$transaction(async (tx) => {
        await rollbackTokens(userId, regenerateCost, tx, `seo-regenerate:${userId}:${jobId}`);
      }, { isolationLevel: 'Serializable' });

      await syncSessionStatus(jobId, 'failed');

      return;
    }
  }

  await prisma.$transaction(async (tx) => {
    await finalizeTokens(userId, regenerateCost, tx, `seo-regenerate:${userId}:${jobId}`);
  }, { isolationLevel: 'Serializable' });

  const finalHtml = (ctx.data.assembly as Record<string, unknown>)?.article_html as string | undefined;
  const finalMeta = ctx.data.assembly as Record<string, unknown> | undefined;
  await syncSessionStatus(jobId, 'completed', {
    contentText: finalHtml,
    outputMeta: {
      metadata: finalMeta?.metadata,
      quality_metrics: finalMeta?.qualityMetrics,
    },
  });

  await saveRedisState(jobId, {
    jobId,
    status: 'completed',
    currentStep: steps.length - 1,
    totalSteps: steps.length,
    stepName: 'done',
    progress: 100,
    result: ctx.data,
    originalInput: state.originalInput,
  });

  await updateJobStep(jobId, {
    status: 'completed',
    output: ctx.data as unknown as Prisma.JsonObject,
    endedAt: new Date(),
  });
}
