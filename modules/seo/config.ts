// modules/seo/config.ts — Step Model Config reader
import type { ToolConfig } from '@/core/types';

/**
 * Достать модель для конкретного шага из config.models.
 * Если шаг не найден или config отсутствует — вернуть fallback.
 *
 * Использование в шагах пайплайна:
 *   const model = getStepModel(config, 'draft', 'anthropic/claude-sonnet-4-5');
 */
export function getStepModel(
  config: ToolConfig | null,
  stepName: string,
  fallback: string,
): string {
  return config?.models?.[stepName] ?? fallback;
}

/**
 * Все логические имена шагов и их дефолтные модели.
 * Справочник — не источник истины. Источник — config.models из БД.
 */
export const DEFAULT_STEP_MODELS: Record<string, string> = {
  moderation: 'google/gemini-2.5-flash',
  brief: 'google/gemini-2.5-flash',
  moderation_headings: 'google/gemini-2.5-flash',
  draft: 'anthropic/claude-sonnet-4-5',
  image_prompt: 'google/gemini-2.5-flash',
  image_gen: 'bytedance/seedream-4.5',
  ai_detect: 'anthropic/claude-sonnet-4-5',
  revisions: 'anthropic/claude-sonnet-4-5',
};
