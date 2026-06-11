// app/api/referral/route.ts — статистика партнёрки текущего пользователя
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { getReferralStats } from '@/modules/referral/referral.service';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();
  try {
    const data = await getReferralStats(session.user.id);
    return NextResponse.json({ data });
  } catch (e) {
    return apiError(e, 'GET /api/referral');
  }
}
