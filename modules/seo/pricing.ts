// modules/seo/pricing.ts — расчёт цены статьи на основе оценочной себестоимости
import type { PriceBreakdown } from './types';
import { estimateArticleCost } from './cost-model';

export interface PricingConfig {
  analysisShare: number;
}

const DEFAULT_PRICING: PricingConfig = {
  analysisShare: 0.15,
};

/**
 * Рассчитать цену статьи (вперёд, до генерации).
 * Цена = себестоимость текста × 3 + себестоимость картинок × 2 (см. cost-model).
 * faqCount оставлен в сигнатуре для совместимости, в новой модели не влияет на цену напрямую.
 */
export function calculatePrice(
  charCount: number,
  imageCount: number,
  _faqCount: number,
  config?: Partial<PricingConfig> | null,
  aiModel: string = 'opus47',
  analysisModel: string = 'sonnet',
): PriceBreakdown {
  const c = { ...DEFAULT_PRICING, ...config };
  const est = estimateArticleCost(charCount, imageCount, aiModel, analysisModel);

  const analysisCost = Math.round(est.total * c.analysisShare);

  return {
    base: 0,
    chars: est.textPrice,                                  // цена текстовой части
    images: est.imagePrice,                                // цена картинок
    faq: 0,
    multiplier: 3,
    totalBeforeMultiplier: Math.round(est.textCostRub + est.imageCostRub), // себестоимость
    total: est.total,
    analysisCost,
  };
}
