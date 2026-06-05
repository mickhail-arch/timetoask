// modules/billing/model-pricing.ts — цены моделей OpenRouter ($ за 1M токенов).
// Источник истины для расчёта реальной себестоимости.
import { env } from '@/core/config/env';

type Price = { in: number; out: number };

// Ключ — подстрока, по которой матчим модель. Проверяется по порядку.
const MODEL_PRICES: { match: string; price: Price }[] = [
  { match: 'opus', price: { in: 5, out: 25 } },
  { match: 'sonnet', price: { in: 3, out: 15 } },
  { match: 'gemini-3', price: { in: 2, out: 12 } },
  { match: 'gemini', price: { in: 2, out: 12 } },
];

const DEFAULT_PRICE: Price = { in: 3, out: 15 };

function priceFor(model: string): Price {
  const lower = model.toLowerCase();
  return MODEL_PRICES.find((p) => lower.includes(p.match))?.price ?? DEFAULT_PRICE;
}

/**
 * Реальная себестоимость вызова OpenRouter в рублях.
 */
export function calculateCostRub(model: string, promptTokens: number, completionTokens: number): number {
  const p = priceFor(model);
  const costUsd = (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
  return costUsd * env.USD_RUB_RATE;
}

// Цена генерации одного изображения, $ (фиксированная, не за токены)
const IMAGE_PRICES: { match: string; usd: number }[] = [
  { match: 'gemini-3.1-flash-image', usd: 0.0673 },
  { match: 'flash-image', usd: 0.0673 },
  { match: 'image', usd: 0.04 },
];

export function calculateImageCostRub(model: string): number {
  const lower = model.toLowerCase();
  const usd = IMAGE_PRICES.find((p) => lower.includes(p.match))?.usd ?? 0.04;
  return usd * env.USD_RUB_RATE;
}
