// app/api/admin/analytics/route.ts — метрики дашборда (только admin)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { getDashboardMetrics } from '@/modules/admin/analytics.service';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Недостаточно прав', statusCode: 403 } }, { status: 403 });
  }
  try {
    const data = await getDashboardMetrics();
    return NextResponse.json({ data });
  } catch (e) {
    return apiError(e, 'GET /api/admin/analytics');
  }
}
