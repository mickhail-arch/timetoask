// modules/seo/pricing.ts — динамический расчёт стоимости
import type { PriceBreakdown } from './types';

export interface PricingConfig {
  base: number;
  perCharBlock: number;
  perImage: number;
  perFaq: number;
  charBlockSize: number;
  sonnetMultiplier: number;
}

const DEFAULT_PRICING: PricingConfig = {
  base: 100,
  perCharBlock: 3,
  perImage: 15,
  perFaq: 5,
  charBlockSize: 1000,
  sonnetMultiplier: 0.35,
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
  aiModel: string = 'opus',
): PriceBreakdown {
  const c = { ...DEFAULT_PRICING, ...config };

  const chars = Math.ceil(charCount / c.charBlockSize) * c.perCharBlock;
  const images = imageCount * c.perImage;
  const faq = faqCount * c.perFaq;
  const total = c.base + chars + images + faq;

  const multiplier = aiModel === 'sonnet' ? c.sonnetMultiplier : 1;
  const finalTotal = Math.round(total * multiplier);

  return {
    base: c.base,
    chars,
    images,
    faq,
    multiplier,
    totalBeforeMultiplier: total,
    total: finalTotal,
  };
}
