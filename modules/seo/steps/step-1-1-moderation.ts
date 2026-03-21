// modules/seo/steps/step-1-1-moderation.ts — LLM-модерация входных данных
import { llmModerate } from '@/adapters/moderation';
import { getStepModel } from '@/modules/seo/config';
import type { StepResult, PipelineContext } from '../types';

export async function executeModeration(ctx: PipelineContext): Promise<StepResult> {
  const start = Date.now();

  const model = getStepModel(
    ctx.config as import('@/core/types').ToolConfig | null,
    'moderation',
    'google/gemini-2.5-flash',
  );

  // Собрать все текстовые поля для проверки
  const fields = [
    ctx.input.target_query,
    ctx.input.keywords,
    ctx.input.brand,
    ctx.input.cta,
    ctx.input.own_sources,
    ctx.input.forbidden_words,
    ctx.input.legal_restrictions,
  ].filter(Boolean).join('\n');

  const result = await llmModerate(fields, model);

  if (result.category === 'A') {
    return {
      success: false,
      data: { category: 'A', reason: result.reason },
      error: `Контент содержит запрещённый материал: ${result.reason ?? 'категория A'}`,
      durationMs: Date.now() - start,
    };
  }

  return {
    success: true,
    data: {
      category: result.category,
      reason: result.reason,
      sensitive_topic: result.category === 'B',
      add_disclaimer: result.category === 'C',
    },
    durationMs: Date.now() - start,
  };
}
