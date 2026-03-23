// modules/seo/config.ts — Step Model Config reader
import type { ToolConfig } from '@/core/types';

/**
 * Достать модель для конкретного шага из config.models.
 * Если шаг не найден или config отсутствует — вернуть fallback.
 *
 * Использование в шагах пайплайна:
 *   const model = getStepModel(config, 'draft', 'anthropic/claude-opus-4.6');
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
  brief: 'anthropic/claude-opus-4.6',
  moderation_headings: 'google/gemini-2.5-flash',
  draft: 'anthropic/claude-opus-4.6',
  image_prompt: 'google/gemini-2.5-flash',
  image_gen: 'google/gemini-3.1-flash-image-preview',
  ai_detect: 'anthropic/claude-opus-4.6',
  revisions: 'anthropic/claude-opus-4.6',
  assembly: 'anthropic/claude-opus-4.6',
};
