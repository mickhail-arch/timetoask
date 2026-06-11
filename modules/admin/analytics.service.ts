// modules/admin/analytics.service.ts — метрики дашборда
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';

export interface DashboardMetrics {
  revenue: number;          // выручка, ₽ (Σ succeeded transactions)
  cost: number;             // себестоимость OpenRouter, ₽ (Σ costRub)
  profit: number;           // прибыль = выручка − себестоимость
  articlesTotal: number;    // завершённых статей всего
  articlesByDay: { date: string; count: number }[]; // за 14 дней
  openrouterStatus: 'ok';   // заглушка
}

export async function getDashboardMetrics(params: { from?: string; to?: string } = {}): Promise<DashboardMetrics> {
  const { from, to } = params;
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = new Date(from + 'T00:00:00');
  if (to) range.lte = new Date(to + 'T23:59:59.999');
  const dateWhere = from != null || to != null ? { createdAt: range } : {};

  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [revenueAgg, costAgg, articlesTotal, sessions] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'succeeded', ...dateWhere } }),
    prisma.usageLog.aggregate({ _sum: { costRub: true }, where: { ...dateWhere } }),
    prisma.toolSession.count({ where: { status: 'completed', ...dateWhere } }),
    prisma.toolSession.findMany({
      where: { status: 'completed', createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const revenue = Number(revenueAgg._sum.amount ?? new Prisma.Decimal(0));
  const cost = Number(costAgg._sum.costRub ?? new Prisma.Decimal(0));

  const counts = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    counts.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of sessions) {
    const key = s.createdAt.toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const articlesByDay = Array.from(counts.entries()).map(([date, count]) => ({ date, count }));

  return {
    revenue,
    cost: Math.round(cost * 100) / 100,
    profit: Math.round((revenue - cost) * 100) / 100,
    articlesTotal,
    articlesByDay,
    openrouterStatus: 'ok',
  };
}

export interface ActivityRow {
  id: string;
  email: string;
  title: string;
  status: string;
  tokens: number;
  revenue: number;   // доход: цена статьи (списано с баланса)
  cost: number;      // себестоимость OpenRouter, ₽
  profit: number;    // доход − себестоимость
  createdAt: string;
}

export interface ActivityFilters {
  from?: string;
  to?: string;
  email?: string;
  sort?: 'date' | 'email' | 'revenue' | 'cost' | 'profit' | 'tokens';
  dir?: 'asc' | 'desc';
  limit?: number;
}

export async function getActivityLog(params: ActivityFilters = {}): Promise<ActivityRow[]> {
  const { from, to, email, sort = 'date', dir = 'desc', limit = 500 } = params;

  const where: Prisma.ToolSessionWhereInput = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); where.createdAt.lte = t; }
  }
  if (email) where.user = { email: { contains: email, mode: 'insensitive' } };

  const sessions = await prisma.toolSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      status: true,
      outputMeta: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  const ids = sessions.map((s) => s.id);
  const usage = await prisma.usageLog.groupBy({
    by: ['sessionId'],
    where: { sessionId: { in: ids } },
    _sum: { costRub: true, tokensUsed: true },
  });
  const usageMap = new Map(usage.map((u) => [u.sessionId, u._sum]));

  const rows: ActivityRow[] = sessions.map((s) => {
    const agg = usageMap.get(s.id);
    const cost = Number(agg?.costRub ?? 0);
    const meta = (s.outputMeta as Record<string, unknown> | null) ?? {};
    const revenue = Number(meta.price ?? 0);
    return {
      id: s.id,
      email: s.user.email,
      title: s.title,
      status: s.status,
      tokens: agg?.tokensUsed ?? 0,
      revenue,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
      createdAt: s.createdAt.toISOString(),
    };
  });

  const sign = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    switch (sort) {
      case 'email': return sign * a.email.localeCompare(b.email);
      case 'revenue': return sign * (a.revenue - b.revenue);
      case 'cost': return sign * (a.cost - b.cost);
      case 'profit': return sign * (a.profit - b.profit);
      case 'tokens': return sign * (a.tokens - b.tokens);
      default: return sign * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  });

  return rows;
}

export interface GenerationActivity {
  points: { label: string; count: number }[];
  total: number;
}

export async function getGenerationActivity(params: { from?: string; to?: string } = {}): Promise<GenerationActivity> {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const now = new Date();

  const end = params.to ? new Date(params.to + 'T23:59:59.999') : now;

  let start: Date;
  if (params.from) {
    start = new Date(params.from + 'T00:00:00');
  } else {
    const first = await prisma.toolSession.findFirst({
      where: { status: 'completed' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    start = first ? new Date(first.createdAt) : new Date(now);
    if (!first) start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }

  const sessions = await prisma.toolSession.findMany({
    where: { status: 'completed', createdAt: { gte: start, lte: end } },
    select: { createdAt: true },
  });

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const singleDay = !!params.from && !!params.to && params.from === params.to;

  const buckets: { key: string; label: string }[] = [];
  let keyOf: (d: Date) => string | null;

  if (singleDay) {
    const day = new Date(params.from + 'T00:00:00');
    const lastHour = sameDay(day, now) ? now.getHours() : 23;
    for (let h = 0; h <= lastHour; h++) buckets.push({ key: `h${h}`, label: `${pad2(h)}:00` });
    keyOf = (d) => (sameDay(d, day) ? `h${d.getHours()}` : null);
  } else {
    const cur = new Date(start);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`;
      buckets.push({ key, label: `${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}` });
      cur.setDate(cur.getDate() + 1);
    }
    keyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  const counts = new Map<string, number>(buckets.map((b) => [b.key, 0]));
  for (const s of sessions) {
    const k = keyOf(s.createdAt);
    if (k && counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const points = buckets.map((b) => ({ label: b.label, count: counts.get(b.key) ?? 0 }));
  const total = points.reduce((acc, p) => acc + p.count, 0);
  return { points, total };
}

export interface HealthLogRow {
  id: string;
  model: string;
  label: string;
  status: string;
  response: string | null;
  errorMessage: string | null;
  tokens: number;
  costRub: number;
  latencyMs: number;
  createdAt: string;
}

export interface HealthLogFilters { from?: string; to?: string; limit?: number }

export async function getHealthCheckLog(params: HealthLogFilters = {}): Promise<HealthLogRow[]> {
  const { from, to, limit = 200 } = params;
  const where: Prisma.HealthCheckLogWhereInput = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); where.createdAt.lte = t; }
  }
  const rows = await prisma.healthCheckLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    model: r.model,
    label: r.label,
    status: r.status,
    response: r.response,
    errorMessage: r.errorMessage,
    tokens: r.promptTokens + r.completionTokens,
    costRub: Math.round(Number(r.costRub) * 10000) / 10000,
    latencyMs: r.latencyMs,
    createdAt: r.createdAt.toISOString(),
  }));
}
