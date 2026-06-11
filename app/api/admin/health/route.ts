// app/api/admin/health/route.ts — статус OpenRouter и моделей (admin)
import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api-helpers';
import { getHealth } from '@/modules/health';

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;
  try {
    const force = new URL(req.url).searchParams.get('force') === '1';
    const data = await getHealth(force);
    return NextResponse.json({ data });
  } catch (e) {
    return apiError(e, 'GET /api/admin/health');
  }
}
