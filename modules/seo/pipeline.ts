// modules/seo/pipeline.ts — SEO pipeline runner
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

export async function saveRedisState(jobId: string, state: Partial<PipelineState>): Promise<void> {
  await redis.setex(redisKey(jobId), REDIS_TTL, JSON.stringify(state));
}

export async function getRedisState(jobId: string): Promise<PipelineState | null> {
  const raw = await redis.get(redisKey(jobId));
  if (!raw) return null;
  return JSON.parse(raw) as PipelineState;
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
): Promise<void> {
  const ctx: PipelineContext = {
    jobId,
    userId,
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
          await finalizeTokens(userId, analysisCost, tx);
        }, { isolationLevel: 'Serializable' });

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
          await rollbackTokens(userId, analysisCost, tx);
        }, { isolationLevel: 'Serializable' });
      }

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
  if (!state) throw new Error('Job state not found in Redis');

  const ctx: PipelineContext = {
    jobId,
    userId,
    input: state.originalInput ?? state.result ?? {},
    config,
    data: { ...state.result, confirmation: { brief: updatedBrief, user_edited: true } },
  };

  const remainingSteps = steps.slice(resumeFromIndex);

  await updateJobStep(jobId, {
    status: 'processing',
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
        await rollbackTokens(userId, remainingCost, tx);
      }, { isolationLevel: 'Serializable' });

      return;
    }
  }

  await prisma.$transaction(async (tx) => {
    await finalizeTokens(userId, remainingCost, tx);
  }, { isolationLevel: 'Serializable' });

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
  if (!state) throw new Error('Job state not found in Redis');

  const ctx: PipelineContext = {
    jobId,
    userId,
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
        await rollbackTokens(userId, regenerateCost, tx);
      }, { isolationLevel: 'Serializable' });
      return;
    }
  }

  await prisma.$transaction(async (tx) => {
    await finalizeTokens(userId, regenerateCost, tx);
  }, { isolationLevel: 'Serializable' });

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
