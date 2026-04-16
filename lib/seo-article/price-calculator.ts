// lib/seo-article/price-calculator.ts — клиентский калькулятор цены (зеркало серверного)

export interface PricingConfig {
  base: number;
  perCharBlock: number;
  perImage: number;
  perFaq: number;
  charBlockSize: number;
  sonnetMultiplier: number;
}

export interface PriceBreakdown {
  base: number;
  chars: number;
  images: number;
  faq: number;
  total: number;
  multiplier: number;
  totalBeforeMultiplier: number;
}

const DEFAULT: PricingConfig = {
  base: 100,
  perCharBlock: 3,
  perImage: 15,
  perFaq: 5,
  charBlockSize: 1000,
  sonnetMultiplier: 0.35,
};

export function calculatePriceClient(
  charCount: number,
  imageCount: number,
  faqCount: number,
  config?: Partial<PricingConfig> | null,
  aiModel: string = 'opus',
): PriceBreakdown {
  const c = { ...DEFAULT, ...config };
  const chars = Math.ceil(charCount / c.charBlockSize) * c.perCharBlock;
  const images = imageCount * c.perImage;
  const faq = faqCount * c.perFaq;
  const totalBeforeMultiplier = c.base + chars + images + faq;
  const multiplier = aiModel === 'sonnet' ? c.sonnetMultiplier : 1;
  const total = Math.round(totalBeforeMultiplier * multiplier);
  return { base: c.base, chars, images, faq, total, multiplier, totalBeforeMultiplier };
}
