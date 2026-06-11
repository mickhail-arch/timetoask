// app/api/admin/users/route.ts — список аккаунтов (только admin)
import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/api-helpers';
import { getUsers } from '@/modules/admin/admin.service';

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email') ?? undefined;
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const result = await getUsers({ email }, { page, limit });
    return NextResponse.json({ data: result });
  } catch (e) {
    return apiError(e, 'GET /api/admin/users');
  }
}
