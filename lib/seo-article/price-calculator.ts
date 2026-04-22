// lib/seo-article/price-calculator.ts — клиентский калькулятор цены (зеркало серверного)

export interface PricingConfig {
  base: number;
  perCharBlock: number;
  perImage: number;
  perFaq: number;
  charBlockSize: number;
  sonnetMultiplier: number;
  geminiMultiplier: number;
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
  geminiMultiplier: 0.25,
};

export function calculatePriceClient(
  charCount: number,
  imageCount: number,
  faqCount: number,
  config?: Partial<PricingConfig> | null,
  aiModel: string = 'opus47',
  analysisModel: string = 'sonnet',
): PriceBreakdown {
  const c = { ...DEFAULT, ...config };
  const chars = Math.ceil(charCount / c.charBlockSize) * c.perCharBlock;
  const images = imageCount * c.perImage;
  const faq = faqCount * c.perFaq;
  const totalBeforeMultiplier = c.base + chars + images + faq;
  const multiplier = aiModel === 'gemini' ? c.geminiMultiplier
    : aiModel === 'sonnet' ? c.sonnetMultiplier
    : 1;
  const analysisExtra = analysisModel === 'opus47' ? 0.4 : 0;
  const total = Math.round(totalBeforeMultiplier * multiplier * (1 + analysisExtra));
  return { base: c.base, chars, images, faq, total, multiplier, totalBeforeMultiplier };
}
