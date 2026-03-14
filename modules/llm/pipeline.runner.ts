import { prisma } from '@/lib/prisma';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { wrapSystemPrompt } from './prompt-guard';
import { Prisma } from '../../generated/prisma';
import type { PipelineStepDef, PipelineContext, ToolRecord } from './pipeline.types';

export function pipelineLlm(
  step: PipelineStepDef,
  ctx: PipelineContext,
  userMessage: string,
) {
  return generateText({
    model: step.modelOverride ?? ctx.model,
    systemPrompt: wrapSystemPrompt(ctx.tool.promptText),
    userMessage,
  });
}

export async function runMultiStepPipeline(
  parentJobId: string,
  userId: string,
  tool: ToolRecord,
  rawInput: string,
  steps: PipelineStepDef[],
): Promise<void> {
  const input = JSON.parse(rawInput) as Record<string, unknown>;

  const ctx: PipelineContext = {
    parentJobId,
    userId,
    tool,
    input,
    data: {},
    model: tool.model,
  };

  await prisma.jobStep.update({
    where: { id: parentJobId },
    data: { status: 'processing', startedAt: new Date() },
  });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

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
            currentStep: i,
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
          error: `Step "${step.name}" (${i}/${steps.length}) failed: ${message}`,
          endedAt: new Date(),
        },
      });

      return;
    }
  }

  const finalOutput = ctx.data;

  await prisma.jobStep.update({
    where: { id: parentJobId },
    data: {
      status: 'completed',
      output: finalOutput as Prisma.JsonObject,
      endedAt: new Date(),
    },
  });
}
