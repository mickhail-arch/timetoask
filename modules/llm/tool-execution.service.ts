// modules/llm/tool-execution.service.ts — Tool execution orchestration

import { prisma } from '@/lib/prisma';
import { acquireSlot, releaseSlot } from '@/lib/concurrency';
import {
  reserveTokens,
  finalizeTokens,
  rollbackTokens,
} from '@/modules/billing/billing.service';
import { streamText, generateText } from '@/adapters/llm/openrouter.adapter';
import { wrapSystemPrompt } from './prompt-guard';
import { env } from '@/core/config/env';
import { STALE_JOB_BUFFER_MS } from '@/core/constants';
import {
  TooManyRequestsError,
  ForbiddenError,
  ValidationError,
} from '@/core/errors';
import type { JobStatus } from '@/core/types';

type ToolRecord = {
  id: string;
  model: string;
  promptText: string;
  tokenCost: number;
  slug: string;
  name: string;
};

export type JobStatusResponse = {
  jobId: string;
  status: JobStatus;
  output: unknown | null;
  error: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
};

// ---------------------------------------------------------------------------
// executeSync
// ---------------------------------------------------------------------------

export async function* executeSync(
  userId: string,
  tool: ToolRecord,
  input: string,
): AsyncGenerator<string> {
  const acquired = await acquireSlot(userId);
  if (!acquired) throw new TooManyRequestsError();

  try {
    const idempotencyKey = `sync:${userId}:${tool.id}:${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      await reserveTokens(userId, tool.tokenCost, idempotencyKey, tx);
    });

    let fullText = '';
    try {
      const systemPrompt = wrapSystemPrompt(tool.promptText);
      const stream = streamText({
        model: tool.model,
        systemPrompt,
        userMessage: input,
      });

      for await (const chunk of stream) {
        fullText += chunk;
        yield chunk;
      }

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
            { chatId: chat.id, role: 'assistant', content: fullText },
          ],
        });

        await tx.usageLog.create({
          data: {
            userId,
            toolId: tool.id,
            idempotencyKey,
            tokensUsed: Math.ceil(fullText.length / 4),
            cost: tool.tokenCost,
          },
        });
      });
    } catch (err) {
      await prisma.$transaction(async (tx) => {
        await rollbackTokens(userId, tool.tokenCost, tx);
      });
      throw err;
    }
  } finally {
    await releaseSlot(userId);
  }
}

// ---------------------------------------------------------------------------
// executeAsync
// ---------------------------------------------------------------------------

export async function executeAsync(
  userId: string,
  tool: ToolRecord,
  input: string,
): Promise<{ jobId: string }> {
  const activeCount = await prisma.jobStep.count({
    where: {
      userId,
      status: { in: ['pending', 'processing'] },
    },
  });

  if (activeCount >= env.MAX_CONCURRENT_ASYNC) {
    throw new TooManyRequestsError();
  }

  const job = await prisma.jobStep.create({
    data: {
      userId,
      toolId: tool.id,
      status: 'pending',
      input: { userMessage: input },
    },
  });

  void runAsyncPipeline(job.id, userId, tool, input);

  return { jobId: job.id };
}

// ---------------------------------------------------------------------------
// runAsyncPipeline (private)
// ---------------------------------------------------------------------------

async function runAsyncPipeline(
  jobId: string,
  userId: string,
  tool: ToolRecord,
  input: string,
): Promise<void> {
  await prisma.jobStep.update({
    where: { id: jobId },
    data: { status: 'processing', startedAt: new Date() },
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
        output: { result },
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
        console.error(`[tool-execution] rollback failed for job=${jobId}`);
      }
    }

    const message = err instanceof Error ? err.message : String(err);
    await prisma.jobStep.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: message,
        endedAt: new Date(),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// getJobStatus
// ---------------------------------------------------------------------------

export async function getJobStatus(
  jobId: string,
  userId: string,
): Promise<JobStatusResponse> {
  const job = await prisma.jobStep.findUnique({ where: { id: jobId } });

  if (!job) {
    throw new ValidationError('Job not found');
  }

  if (job.userId !== userId) {
    throw new ForbiddenError();
  }

  return {
    jobId: job.id,
    status: job.status as JobStatus,
    output: job.output,
    error: job.error,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
  };
}

// ---------------------------------------------------------------------------
// cleanupStaleJobs
// ---------------------------------------------------------------------------

export async function cleanupStaleJobs(): Promise<void> {
  const cutoff = new Date(
    Date.now() - env.MAX_EXECUTION_TIMEOUT_MS - STALE_JOB_BUFFER_MS,
  );

  const stale = await prisma.jobStep.findMany({
    where: {
      status: 'processing',
      startedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (stale.length === 0) return;

  await prisma.jobStep.updateMany({
    where: { id: { in: stale.map((j) => j.id) } },
    data: {
      status: 'failed',
      error: 'Execution timeout',
      endedAt: new Date(),
    },
  });

  console.warn(
    `[tool-execution] cleanupStaleJobs: marked ${stale.length} stale job(s) as failed`,
  );
}
