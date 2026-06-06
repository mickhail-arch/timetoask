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
  const rawChars = Math.ceil(charCount / c.charBlockSize) * c.perCharBlock;
  const rawImages = imageCount * c.perImage;
  const faq = faqCount * c.perFaq;
  const totalBeforeMultiplier = c.base + rawChars + rawImages + faq;
  const multiplier = aiModel === 'gemini' ? c.geminiMultiplier
    : aiModel === 'sonnet' ? c.sonnetMultiplier
    : 1;
  const analysisExtra = analysisModel === 'opus47' ? 0.4 : 0;
  const factor = multiplier * (1 + analysisExtra);
  const total = Math.round(totalBeforeMultiplier * factor);
  // Части в тех же единицах, что и total: картинки — их вклад, текст — остаток (вкл. базу/faq).
  const images = Math.round(rawImages * factor);
  const chars = Math.max(0, total - images);
  return { base: c.base, chars, images, faq, total, multiplier, totalBeforeMultiplier };
}
