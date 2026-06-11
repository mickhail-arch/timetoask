// app/api/admin/activity/route.ts — журнал активности (только admin)
import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api-helpers';
import { getActivityLog } from '@/modules/admin/analytics.service';

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;
  try {
    const sp = new URL(req.url).searchParams;
    const sortRaw = sp.get('sort');
    const allowed = ['date', 'email', 'revenue', 'cost', 'profit', 'tokens'] as const;
    const sort = (allowed as readonly string[]).includes(sortRaw ?? '') ? (sortRaw as typeof allowed[number]) : 'date';
    const rows = await getActivityLog({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      email: sp.get('email') ?? undefined,
      sort,
      dir: sp.get('dir') === 'asc' ? 'asc' : 'desc',
    });
    return NextResponse.json({ data: rows });
  } catch (e) {
    return apiError(e, 'GET /api/admin/activity');
  }
}
