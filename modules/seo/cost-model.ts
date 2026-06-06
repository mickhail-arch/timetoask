// modules/seo/cost-model.ts — оценка цены статьи вперёд (по шагам и моделям)
import {
  calculateCostRub,
  calculateImageCostRub,
  TEXT_MARKUP,
  IMAGE_MARKUP,
  MIN_ARTICLE_PRICE,
} from '@/modules/billing/model-pricing';

// Выбор модели пользователя → строка OpenRouter
const DRAFT_MODEL_MAP: Record<string, string> = {
  gemini: 'google/gemini-3.1-pro-preview',
  sonnet: 'anthropic/claude-sonnet-4.6',
  opus47: 'anthropic/claude-opus-4-8',
};
const ANALYSIS_MODEL_MAP: Record<string, string> = {
  gemini: 'google/gemini-3.1-pro-preview',
  sonnet: 'anthropic/claude-sonnet-4.6',
  opus47: 'anthropic/claude-opus-4-8',
};
const SONNET = 'anthropic/claude-sonnet-4.6';
const FLASH = 'google/gemini-2.5-flash';
const IMAGE_GEN = 'google/gemini-3.1-flash-image-preview';

export interface ArticleCostEstimate {
  textCostRub: number;   // себестоимость текстовых шагов
  imageCostRub: number;  // себестоимость картинок
  textPrice: number;     // цена текста юзеру (×TEXT_MARKUP)
  imagePrice: number;    // цена картинок юзеру (×IMAGE_MARKUP)
  total: number;         // итоговая цена
}

/**
 * Оценить цену статьи ДО генерации.
 * Токены оцениваются по объёму (русский ≈ 2 знака/токен).
 */
export function estimateArticleCost(
  charCount: number,
  imageCount: number,
  aiModel: string,
  analysisModel: string,
): ArticleCostEstimate {
  const draftModel = DRAFT_MODEL_MAP[aiModel] ?? DRAFT_MODEL_MAP.opus47;
  const analModel = ANALYSIS_MODEL_MAP[analysisModel] ?? SONNET;
  const half = Math.ceil(charCount / 2); // токены текста статьи

  let textCostRub = 0;
  // brief
  textCostRub += calculateCostRub(SONNET, 1500, 800);
  // draft (написание) — главный расход
  textCostRub += calculateCostRub(draftModel, 2000, half);
  // content_analysis
  textCostRub += calculateCostRub(analModel, half, 500);
  // ai_detect_revisions
  textCostRub += calculateCostRub(analModel, half, Math.ceil(charCount / 3));
  // targeted_rewrite
  textCostRub += calculateCostRub(analModel, half, Math.ceil(charCount / 4));
  // assembly
  textCostRub += calculateCostRub(SONNET, half, 300);
  // image prompts (по одному на картинку)
  textCostRub += imageCount * calculateCostRub(FLASH, 500, 200);

  const imageCostRub = imageCount * calculateImageCostRub(IMAGE_GEN);

  const textPrice = textCostRub * TEXT_MARKUP;
  const imagePrice = imageCostRub * IMAGE_MARKUP;
  const total = Math.max(MIN_ARTICLE_PRICE, Math.round(textPrice + imagePrice));

  return {
    textCostRub: Math.round(textCostRub * 100) / 100,
    imageCostRub: Math.round(imageCostRub * 100) / 100,
    textPrice: Math.round(textPrice),
    imagePrice: Math.round(imagePrice),
    total,
  };
}
