// app/api/billing/balance/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBalance } from '@/modules/billing/billing.service';
import { unauthorized, apiError } from '@/lib/api-helpers';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  try {
    const balance = await getBalance(session.user.id);
    return NextResponse.json({ data: balance });
  } catch (e) { return apiError(e, 'GET /api/billing/balance'); }
}
