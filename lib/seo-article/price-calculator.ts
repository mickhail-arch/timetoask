// lib/seo-article/price-calculator.ts — клиентский калькулятор цены (зеркало серверного)

export interface PricingConfig {
  base: number;
  perCharBlock: number;
  perImage: number;
  perFaq: number;
  charBlockSize: number;
}

export interface PriceBreakdown {
  base: number;
  chars: number;
  images: number;
  faq: number;
  total: number;
}

const DEFAULT: PricingConfig = {
  base: 100,
  perCharBlock: 3,
  perImage: 15,
  perFaq: 5,
  charBlockSize: 1000,
};

export function calculatePriceClient(
  charCount: number,
  imageCount: number,
  faqCount: number,
  config?: Partial<PricingConfig> | null,
): PriceBreakdown {
  const c = { ...DEFAULT, ...config };
  const chars = Math.ceil(charCount / c.charBlockSize) * c.perCharBlock;
  const images = imageCount * c.perImage;
  const faq = faqCount * c.perFaq;
  const total = c.base + chars + images + faq;
  return { base: c.base, chars, images, faq, total };
}
