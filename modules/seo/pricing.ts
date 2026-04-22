// modules/seo/pricing.ts — динамический расчёт стоимости
import type { PriceBreakdown } from './types';

export interface PricingConfig {
  base: number;
  perCharBlock: number;
  perImage: number;
  perFaq: number;
  charBlockSize: number;
  sonnetMultiplier: number;
  geminiMultiplier: number;
}

const DEFAULT_PRICING: PricingConfig = {
  base: 100,
  perCharBlock: 3,
  perImage: 15,
  perFaq: 5,
  charBlockSize: 1000,
  sonnetMultiplier: 0.35,
  geminiMultiplier: 0.25,
};

/**
 * Рассчитать стоимость генерации статьи.
 * Формула: base + ceil(chars / charBlockSize) * perCharBlock + images * perImage + faq * perFaq
 * Конфиг читается из manifest.json config.pricing (через БД).
 */
export function calculatePrice(
  charCount: number,
  imageCount: number,
  faqCount: number,
  config?: Partial<PricingConfig> | null,
  aiModel: string = 'opus47',
  analysisModel: string = 'sonnet',
): PriceBreakdown {
  const c = { ...DEFAULT_PRICING, ...config };

  const chars = Math.ceil(charCount / c.charBlockSize) * c.perCharBlock;
  const images = imageCount * c.perImage;
  const faq = faqCount * c.perFaq;
  const baseCost = c.base + chars + images + faq;

  const draftMultiplier = aiModel === 'gemini' ? c.geminiMultiplier
    : aiModel === 'sonnet' ? c.sonnetMultiplier
    : 1;

  const analysisExtra = analysisModel === 'opus47' ? 0.4 : 0;
  const total = Math.round(baseCost * draftMultiplier * (1 + analysisExtra));

  return {
    base: c.base,
    chars,
    images,
    faq,
    multiplier: draftMultiplier,
    totalBeforeMultiplier: baseCost,
    total,
  };
}
