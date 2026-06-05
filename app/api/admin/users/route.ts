// app/api/admin/users/route.ts — список аккаунтов (только admin)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { getUsers } from '@/modules/admin/admin.service';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Недостаточно прав', statusCode: 403 } }, { status: 403 });
  }
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
