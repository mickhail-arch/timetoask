// app/api/admin/health/log/route.ts — журнал проверок LLM (admin)
import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api-helpers';
import { getHealthCheckLog } from '@/modules/admin/analytics.service';

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;
  try {
    const sp = new URL(req.url).searchParams;
    const data = await getHealthCheckLog({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (e) {
    return apiError(e, 'GET /api/admin/health/log');
  }
}
