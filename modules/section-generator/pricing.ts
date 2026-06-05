// modules/section-generator/pricing.ts — расчёт цены раздела (чистый, без серверных зависимостей)
export type SectionModel = 'sonnet' | 'gemini' | 'opus';

// ВНИМАНИЕ: строки моделей должны совпадать с рабочими в проекте. Меняются здесь в одном месте.
export const SECTION_MODELS: { id: SectionModel; label: string; openrouter: string }[] = [
  { id: 'sonnet', label: 'Sonnet', openrouter: 'anthropic/claude-sonnet-4' },
  { id: 'gemini', label: 'Gemini', openrouter: 'google/gemini-3.1-pro-preview' },
  { id: 'opus', label: 'Opus', openrouter: 'anthropic/claude-opus-4-8' },
];

const PRICES: Record<SectionModel, { in: number; out: number }> = {
  sonnet: { in: 3, out: 15 },
  gemini: { in: 2, out: 12 },
  opus: { in: 5, out: 25 },
};

const CHARS_PER_TOKEN = 2;
const INPUT_TOKENS = 800;
const USD_RUB = 90;
const MARKUP = 5;

export const SECTION_RANGES = {
  h2: { min: 500, max: 1500, step: 250, default: 1000 },
  h3: { min: 500, max: 1000, step: 100, default: 700 },
};

export function calculateSectionPrice(chars: number, model: SectionModel): number {
  const p = PRICES[model] ?? PRICES.sonnet;
  const outTokens = chars / CHARS_PER_TOKEN;
  const costUsd = (INPUT_TOKENS * p.in + outTokens * p.out) / 1_000_000;
  return Math.max(1, Math.ceil(costUsd * USD_RUB * MARKUP));
}

export function getOpenRouterModel(model: SectionModel): string {
  return SECTION_MODELS.find((m) => m.id === model)?.openrouter ?? SECTION_MODELS[0].openrouter;
}
