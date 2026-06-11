// modules/health/types.ts — общие типы проверок здоровья провайдеров/роутеров
export type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export interface HealthResult {
  id: string;
  label: string;
  status: HealthStatus;
  detail?: string;
  latencyMs?: number;
  checkedAt: string; // ISO
}

// Одна проверка может вернуть несколько планок (сам роутер + его модели)
// за один бесплатный запрос. Новый роутер = новый файл в checks/ + строка в registry.
export interface HealthCheck {
  id: string;
  run(): Promise<HealthResult[]>;
}
