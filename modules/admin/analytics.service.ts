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

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [revenueAgg, costAgg, articlesTotal, sessions] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'succeeded' } }),
    prisma.usageLog.aggregate({ _sum: { costRub: true } }),
    prisma.toolSession.count({ where: { status: 'completed' } }),
    prisma.toolSession.findMany({
      where: { status: 'completed', createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const revenue = Number(revenueAgg._sum.amount ?? new Prisma.Decimal(0));
  const cost = Number(costAgg._sum.costRub ?? new Prisma.Decimal(0));

  // группировка по дням
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

export async function getActivityLog(limit = 100): Promise<ActivityRow[]> {
  const sessions = await prisma.toolSession.findMany({
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

  return sessions.map((s) => {
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
}
