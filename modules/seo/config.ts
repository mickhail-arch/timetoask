// modules/seo/config.ts — Step Model Config reader
import type { ToolConfig } from '@/core/types';

/**
 * Достать модель для конкретного шага из config.models.
 * Если шаг не найден или config отсутствует — вернуть fallback.
 *
 * Использование в шагах пайплайна:
 *   const model = getStepModel(config, 'draft', 'deepseek/deepseek-v3.2');
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
  draft: 'google/gemini-2.5-flash',
  image_prompt: 'google/gemini-2.5-flash',
  image_gen: 'google/gemini-3.1-flash-image-preview',
  ai_detect: 'google/gemini-2.5-flash',
  revisions: 'google/gemini-2.5-flash',
  assembly: 'google/gemini-2.5-flash',
};
