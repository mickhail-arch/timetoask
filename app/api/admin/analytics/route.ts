// app/api/admin/analytics/route.ts — метрики дашборда (только admin)
import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api-helpers';
import { getDashboardMetrics } from '@/modules/admin/analytics.service';

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;
  try {
    const sp = new URL(req.url).searchParams;
    const data = await getDashboardMetrics({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (e) {
    return apiError(e, 'GET /api/admin/analytics');
  }
}
