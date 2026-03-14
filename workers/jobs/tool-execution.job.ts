// workers/jobs/tool-execution.job.ts — In-process async job runner (MVP, no BullMQ)
// At >100 DAU: extract into a separate worker process and wire processJob to a BullMQ consumer.

import { prisma } from '@/lib/prisma';
import { pipelineRegistry } from '@/modules/llm/pipelines';
import {
  reserveTokens,
  finalizeTokens,
  rollbackTokens,
} from '@/modules/billing/billing.service';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { wrapSystemPrompt } from '@/modules/llm/prompt-guard';
import type {
  PipelineContext,
  PipelineStepDef,
  ToolRecord,
} from '@/modules/llm/pipeline.types';
import { Prisma } from '@/generated/prisma';

// ---------------------------------------------------------------------------
// processJob
// ---------------------------------------------------------------------------

export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.jobStep.findUnique({
    where: { id: jobId },
    include: { tool: true },
  });

  if (!job) {
    console.warn(`[tool-execution.job] job not found: ${jobId}`);
    return;
  }

  if (job.status !== 'pending') {
    console.warn(
      `[tool-execution.job] skipping job ${jobId} — not pending (status=${job.status})`,
    );
    return;
  }

  const tool: ToolRecord = {
    id: job.tool.id,
    model: job.tool.model,
    promptText: job.tool.promptText ?? '',
    tokenCost: Number(job.tool.tokenCost),
    slug: job.tool.slug,
    name: job.tool.name,
  };

  const rawInput =
    (job.input as { userMessage?: string })?.userMessage ?? '';

  const steps = pipelineRegistry[tool.slug];

  if (steps) {
    await executeMultiStep(jobId, job.userId, tool, rawInput, steps);
  } else {
    await executeSingleStep(jobId, job.userId, tool, rawInput);
  }
}

// ---------------------------------------------------------------------------
// executeMultiStep
// ---------------------------------------------------------------------------

async function executeMultiStep(
  parentJobId: string,
  userId: string,
  tool: ToolRecord,
  rawInput: string,
  steps: PipelineStepDef[],
): Promise<void> {
  const input = JSON.parse(rawInput) as Record<string, unknown>;

  await prisma.jobStep.update({
    where: { id: parentJobId },
    data: { status: 'processing', stepIndex: 0, startedAt: new Date() },
  });

  const ctx: PipelineContext = {
    parentJobId,
    userId,
    tool,
    input,
    data: {},
    model: tool.model,
  };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    await prisma.jobStep.update({
      where: { id: parentJobId },
      data: { stepIndex: i },
    });

    const childJob = await prisma.jobStep.create({
      data: {
        parentId: parentJobId,
        stepIndex: i,
        stepName: step.name,
        userId,
        toolId: tool.id,
        status: 'processing',
        input: { step: step.name, parentInput: input } as Prisma.JsonObject,
        startedAt: new Date(),
      },
    });

    try {
      const result = await step.execute(ctx);
      ctx.data[step.name] = result;

      await prisma.jobStep.update({
        where: { id: childJob.id },
        data: {
          status: 'completed',
          output: result as Prisma.JsonObject,
          endedAt: new Date(),
        },
      });

      await prisma.jobStep.update({
        where: { id: parentJobId },
        data: {
          output: {
            currentStep: i + 1,
            totalSteps: steps.length,
            stepName: step.name,
            data: ctx.data,
          } as Prisma.JsonObject,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      await prisma.jobStep.update({
        where: { id: childJob.id },
        data: { status: 'failed', error: message, endedAt: new Date() },
      });

      await prisma.jobStep.update({
        where: { id: parentJobId },
        data: {
          status: 'failed',
          error: `Step "${step.name}" (${i + 1}/${steps.length}) failed: ${message}`,
          endedAt: new Date(),
        },
      });

      return;
    }
  }

  await prisma.jobStep.update({
    where: { id: parentJobId },
    data: {
      status: 'completed',
      output: ctx.data as Prisma.JsonObject,
      endedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// executeSingleStep
// ---------------------------------------------------------------------------

async function executeSingleStep(
  jobId: string,
  userId: string,
  tool: ToolRecord,
  input: string,
): Promise<void> {
  await prisma.jobStep.update({
    where: { id: jobId },
    data: { status: 'processing', stepIndex: 0, startedAt: new Date() },
  });

  const idempotencyKey = `async:${userId}:${tool.id}:${jobId}`;
  let reserved = false;

  try {
    await prisma.$transaction(async (tx) => {
      await reserveTokens(userId, tool.tokenCost, idempotencyKey, tx);
    });
    reserved = true;

    const systemPrompt = wrapSystemPrompt(tool.promptText);
    const result = await generateText({
      model: tool.model,
      systemPrompt,
      userMessage: input,
    });

    await prisma.$transaction(async (tx) => {
      await finalizeTokens(userId, tool.tokenCost, tx);

      let chat = await tx.chat.findFirst({
        where: { userId, toolId: tool.id },
        orderBy: { updatedAt: 'desc' },
      });

      if (!chat) {
        chat = await tx.chat.create({
          data: { userId, toolId: tool.id, title: tool.name },
        });
      }

      await tx.message.createMany({
        data: [
          { chatId: chat.id, role: 'user', content: input },
          { chatId: chat.id, role: 'assistant', content: result },
        ],
      });

      await tx.usageLog.create({
        data: {
          userId,
          toolId: tool.id,
          idempotencyKey,
          tokensUsed: Math.ceil(result.length / 4),
          cost: tool.tokenCost,
        },
      });
    });

    await prisma.jobStep.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        output: { result } as Prisma.JsonObject,
        endedAt: new Date(),
      },
    });
  } catch (err) {
    if (reserved) {
      try {
        await prisma.$transaction(async (tx) => {
          await rollbackTokens(userId, tool.tokenCost, tx);
        });
      } catch {
        console.error(
          `[tool-execution.job] billing rollback failed for job=${jobId}`,
        );
      }
    }

    const message = err instanceof Error ? err.message : String(err);

    await prisma.jobStep.update({
      where: { id: jobId },
      data: { status: 'failed', error: message, endedAt: new Date() },
    });
  }
}
