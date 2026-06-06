// modules/billing/model-pricing.ts — цены моделей OpenRouter ($ за 1M токенов).
// Источник истины для расчёта себестоимости и цены.
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

// Наценка на издержки: рыночный курс × 1.2 (+20% на ввод в OpenRouter, иностранные карты, комиссии)
const COST_OVERHEAD = 1.2;

// Наценки на цену для пользователя
export const TEXT_MARKUP = 3;
export const IMAGE_MARKUP = 2;

// Переписка фрагмента: ставка за символ (₽), как у статьи
export const REWRITE_PRICE_PER_CHAR = 0.02;
export const REWRITE_MIN_PRICE = 3;

// Минимальная цена статьи (защита от убытка)
export const MIN_ARTICLE_PRICE = 50;

function priceFor(model: string): Price {
  const lower = model.toLowerCase();
  return MODEL_PRICES.find((p) => lower.includes(p.match))?.price ?? DEFAULT_PRICE;
}

/**
 * Единая конвертация $ → ₽ с учётом издержек.
 * rate = рыночный курс × 1.2
 */
export function usdToRub(usd: number): number {
  return usd * env.USD_RUB_RATE * COST_OVERHEAD;
}

/**
 * Себестоимость вызова в рублях по токенам и модели (для оценки и фолбэка).
 */
export function calculateCostRub(model: string, promptTokens: number, completionTokens: number): number {
  const p = priceFor(model);
  const costUsd = (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
  return usdToRub(costUsd);
}

/** Себестоимость в ₽ по уже известной реальной стоимости в $ (от OpenRouter). */
export function realCostRub(costUsd: number): number {
  return usdToRub(costUsd);
}

/** Оценочная себестоимость в ₽ по модели и ожидаемым токенам (для цены вперёд). */
export function estimateTokenCostRub(model: string, promptTokens: number, completionTokens: number): number {
  return calculateCostRub(model, promptTokens, completionTokens);
}

/**
 * Цена переписывания фрагмента для пользователя.
 * Прямая ставка за символ (как у статьи).
 */
export function calculateRewritePrice(charCount: number): number {
  return Math.max(REWRITE_MIN_PRICE, Math.round(charCount * REWRITE_PRICE_PER_CHAR));
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
  return usdToRub(usd);
}
