// app/api/admin/impersonate/stop/route.ts — выход из режима поддержки
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  try {
    if (session.impersonatedBy) {
      await prisma.adminAuditLog.create({
        data: {
          adminId: session.impersonatedBy,
          action: 'impersonate_stop',
          targetUserId: session.user.id,
          level: session.impersonationLevel ?? null,
        },
      });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return apiError(e, 'POST /api/admin/impersonate/stop');
  }
}
