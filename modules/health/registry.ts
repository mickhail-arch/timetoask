// modules/health/registry.ts — реестр проверок. Новый роутер: импортируй его HealthCheck и добавь в checks[].
import type { HealthCheck, HealthResult } from './types';
import { openRouterCheck } from './checks/openrouter.check';

const checks: HealthCheck[] = [openRouterCheck];

export async function runHealthChecks(): Promise<HealthResult[]> {
  const settled = await Promise.allSettled(checks.map((c) => c.run()));
  const out: HealthResult[] = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') out.push(...s.value);
    else out.push({ id: checks[i].id, label: checks[i].id, status: 'down', detail: 'Ошибка проверки', checkedAt: new Date().toISOString() });
  });
  return out;
}
