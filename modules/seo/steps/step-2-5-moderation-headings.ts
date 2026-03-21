// modules/seo/steps/step-2-5-moderation-headings.ts — модерация заголовков после редактирования
import type { StepResult, PipelineContext } from '../types';
import { getStepModel } from '../config';
import { llmModerate } from '@/adapters/moderation';
import type { ToolConfig } from '@/core/types';

/**
 * Шаг 2.5: модерация заголовков.
 * Если пользователь не редактировал структуру (user_edited=false) — пропуск.
 * Если редактировал — проверяем только изменённые заголовки.
 * Категория A → success: false.
 */
export async function executeModerationHeadings(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const confirmation = ctx.data.confirmation as {
    brief: Record<string, unknown>;
    user_edited: boolean;
    edited_fields?: string[];
  } | undefined;

  // Если пользователь не редактировал — пропуск
  if (!confirmation?.user_edited) {
    return {
      success: true,
      data: { skipped: true, reason: 'user did not edit headings' },
      durationMs: Date.now() - start,
    };
  }

  // Собрать текст заголовков для проверки
  const brief = confirmation.brief as Record<string, unknown>;
  const h1 = (brief.h1 as string) ?? '';
  const h2List = (brief.h2_list as Array<{ text: string; h3s: string[] }>) ?? [];

  const headingsText = [
    h1,
    ...h2List.map(h2 => h2.text),
    ...h2List.flatMap(h2 => h2.h3s),
  ].filter(Boolean).join('\n');

  // Добавить контекст запроса для модерации
  const targetQuery = (ctx.input.target_query as string) ?? '';
  const textToCheck = `Тема: ${targetQuery}\nЗаголовки:\n${headingsText}`;

  const model = getStepModel(
    ctx.config as ToolConfig | null,
    'moderation_headings',
    'google/gemini-2.5-flash',
  );

  const result = await llmModerate(textToCheck, model);

  if (result.category === 'A') {
    return {
      success: false,
      data: { category: 'A', reason: result.reason },
      error: `Заголовки содержат запрещённый контент: ${result.reason ?? 'нарушение правил'}`,
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
