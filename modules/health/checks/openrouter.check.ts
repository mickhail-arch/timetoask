// modules/health/checks/openrouter.check.ts — OpenRouter + модели.
// Текстовые модели: живой micro-ping (1 токен) с кэшем 1 час — настоящая сквозная проверка, копейки.
// Картинки: presence в каталоге (живая генерация дорогая для ежечасного пинга).
import { env } from '@/core/config/env';
import { redis } from '@/lib/redis';
import { generateTextWithUsage } from '@/adapters/llm';
import { prisma } from '@/lib/prisma';
import { realCostRub, calculateCostRub } from '@/modules/billing/model-pricing';
import type { HealthCheck, HealthResult, HealthStatus } from '../types';

const OR_BASE = 'https://openrouter.ai/api/v1';
const PING_TTL_SEC = 1800; // не чаще раза в 30 минут на модель

const TEXT_MODELS: { id: string; label: string; model: string }[] = [
  { id: 'or-gemini', label: 'Gemini 3.1 Pro', model: 'google/gemini-3.1-pro-preview' },
  { id: 'or-sonnet', label: 'Claude Sonnet 4.6', model: 'anthropic/claude-sonnet-4.6' },
  { id: 'or-opus', label: 'Claude Opus 4.8', model: 'anthropic/claude-opus-4-8' },
  { id: 'or-flash', label: 'Gemini 2.5 Flash', model: 'google/gemini-2.5-flash' },
];
const IMAGE_MODEL = { id: 'or-image', label: 'Gemini 3.1 Flash Image', model: 'google/gemini-3.1-flash-image-preview' };

async function orFetch(path: string, timeoutMs = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${OR_BASE}${path}`, {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

interface PingResult { status: HealthStatus; detail?: string; latencyMs?: number; }

async function pingModel(model: string, label: string): Promise<PingResult> {
  const cacheKey = `health:ping:${model}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as PingResult;
  } catch { /* кэш недоступен — пингуем */ }

  const t0 = Date.now();
  let result: PingResult;
  let logRow: {
    model: string; label: string; status: string;
    response: string | null; errorMessage: string | null;
    promptTokens: number; completionTokens: number; costRub: number; latencyMs: number;
  };

  try {
    const r = await generateTextWithUsage({
      model,
      fallbackModel: model, // проверяем именно эту модель, без подмены
      systemPrompt: 'Отвечай одним словом.',
      userMessage: 'Ответь: ok',
      temperature: 0,
      maxOutputTokens: 256,
    });
    const latencyMs = Date.now() - t0;
    const costRub = typeof r.usage.costUsd === 'number'
      ? realCostRub(r.usage.costUsd)
      : calculateCostRub(model, r.usage.promptTokens, r.usage.completionTokens);
    result = { status: 'ok', latencyMs };
    logRow = {
      model, label, status: 'ok',
      response: r.text.slice(0, 500), errorMessage: null,
      promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens,
      costRub: Math.round(costRub * 10000) / 10000, latencyMs,
    };
  } catch (e) {
    const latencyMs = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[health] ping RAW error model=${model}:`, e instanceof Error ? (e.stack ?? e.message) : e, '| cause:', (e as { cause?: unknown })?.cause);
    result = { status: 'down', detail: msg.slice(0, 80), latencyMs };
    logRow = {
      model, label, status: 'down',
      response: null, errorMessage: msg.slice(0, 500),
      promptTokens: 0, completionTokens: 0, costRub: 0, latencyMs,
    };
  }

  try { await redis.set(cacheKey, JSON.stringify(result), 'EX', PING_TTL_SEC); } catch { /* пропускаем */ }
  try {
    await prisma.healthCheckLog.create({ data: logRow });
    console.log('[health] log written:', logRow.model, logRow.status);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error('[health] log write FAILED for', logRow.model, ':', m);
  }
  return result;
}

export const openRouterCheck: HealthCheck = {
  id: 'openrouter',
  async run(): Promise<HealthResult[]> {
    const now = () => new Date().toISOString();
    if (!env.OPENROUTER_API_KEY) {
      return [{ id: 'openrouter', label: 'OpenRouter', status: 'down', detail: 'API-ключ не задан', checkedAt: now() }];
    }

    const results: HealthResult[] = [];

    // OpenRouter: ключ и баланс (бесплатно)
    const t0 = Date.now();
    try {
      const r = await orFetch('/auth/key');
      results.push({ id: 'openrouter', label: 'OpenRouter', status: r.ok ? 'ok' : 'down', detail: r.ok ? undefined : `HTTP ${r.status}`, latencyMs: Date.now() - t0, checkedAt: now() });
    } catch {
      results.push({ id: 'openrouter', label: 'OpenRouter', status: 'down', detail: 'Нет соединения', latencyMs: Date.now() - t0, checkedAt: now() });
    }

    // Текстовые модели: живой micro-ping (кэш 1 час)
    const pinged = await Promise.all(TEXT_MODELS.map((m) => pingModel(m.model, m.label)));
    TEXT_MODELS.forEach((m, i) => {
      results.push({ id: m.id, label: m.label, status: pinged[i].status, detail: pinged[i].detail, latencyMs: pinged[i].latencyMs, checkedAt: now() });
    });

    // Модель изображений: presence в каталоге (без платной генерации)
    try {
      const r = await orFetch('/models');
      if (r.ok) {
        const j = (await r.json()) as { data?: { id: string }[] };
        const has = new Set((j.data ?? []).map((x) => x.id)).has(IMAGE_MODEL.model);
        results.push({ id: IMAGE_MODEL.id, label: IMAGE_MODEL.label, status: has ? 'ok' : 'down', detail: has ? undefined : 'Нет в каталоге', checkedAt: now() });
      } else {
        results.push({ id: IMAGE_MODEL.id, label: IMAGE_MODEL.label, status: 'unknown', detail: 'Каталог недоступен', checkedAt: now() });
      }
    } catch {
      results.push({ id: IMAGE_MODEL.id, label: IMAGE_MODEL.label, status: 'unknown', detail: 'Каталог недоступен', checkedAt: now() });
    }

    return results;
  },
};
