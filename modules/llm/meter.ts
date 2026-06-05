// modules/llm/meter.ts — обёртка LLM-вызова с учётом реальной себестоимости в usage_log
import { AsyncLocalStorage } from 'node:async_hooks';
import { generateTextWithUsage, type LlmParams } from '@/adapters/llm/openrouter.adapter';
import { calculateCostRub } from '@/modules/billing/model-pricing';
import { env } from '@/core/config/env';
import { prisma } from '@/lib/prisma';

export interface MeterContext {
  userId?: string | null;
  toolId?: string | null;
  feature: string;
  idempotencyKey?: string;
  sessionId?: string | null;
}

type MeterStore = { sessionId?: string | null };
const meterStore = new AsyncLocalStorage<MeterStore>();

/**
 * Устанавливает контекст (sessionId) на всё время выполнения fn,
 * включая вложенные async-вызовы. Используется для привязки расходов к сессии.
 */
export function runWithMeterContext<T>(store: MeterStore, fn: () => Promise<T>): Promise<T> {
  return meterStore.run(store, fn);
}

export async function generateAndMeter(params: LlmParams, ctx: MeterContext): Promise<string> {
  const { text, usage, model } = await generateTextWithUsage(params);

  if (ctx.userId) {
    const costRub = usage.costUsd !== undefined
      ? usage.costUsd * env.USD_RUB_RATE
      : calculateCostRub(model, usage.promptTokens, usage.completionTokens);
    const sessionId = ctx.sessionId ?? meterStore.getStore()?.sessionId ?? null;
    try {
      await prisma.usageLog.create({
        data: {
          userId: ctx.userId,
          toolId: ctx.toolId ?? null,
          sessionId,
          idempotencyKey: ctx.idempotencyKey ?? `${ctx.feature}:${ctx.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          tokensUsed: usage.promptTokens + usage.completionTokens,
          cost: 0,
          costRub,
          model,
        },
      });
    } catch (e) {
      console.error('[meter] failed to log cost', e);
    }
  }

  return text;
}
