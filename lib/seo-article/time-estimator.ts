// lib/seo-article/time-estimator.ts — оценка времени фазы генерации (для UI-таймера обратного отсчёта)
// Коэффициенты приблизительные, вынесены в константы для подстройки по реальным замерам.

const DRAFT_SEC_PER_1K: Record<string, number> = { gemini: 8, sonnet: 14, opus47: 22 };
const QUALITY_SEC_PER_1K: Record<string, number> = { gemini: 6, sonnet: 11, opus47: 18 };
const BASE_SEC = 20;   // модерация заголовков + сборка
const IMAGE_SEC = 30;  // на одну картинку
const MIN_SEC = 30;

/**
 * Оценка длительности фазы генерации (после подтверждения ТЗ):
 * написание → проверка качества → картинки → сборка.
 * aiModel — модель написания, analysisModel — модель проверки/правок.
 */
export function estimateGenerationSeconds(
  charCount: number,
  imageCount: number,
  aiModel: string = 'opus47',
  analysisModel: string = 'sonnet',
): number {
  const draft = DRAFT_SEC_PER_1K[aiModel] ?? DRAFT_SEC_PER_1K.opus47;
  const quality = QUALITY_SEC_PER_1K[analysisModel] ?? QUALITY_SEC_PER_1K.sonnet;
  const k = Math.max(0, charCount) / 1000;
  const total = BASE_SEC + k * draft + k * quality + Math.max(0, imageCount) * IMAGE_SEC;
  return Math.max(MIN_SEC, Math.round(total / 5) * 5);
}
