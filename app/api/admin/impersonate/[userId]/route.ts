// app/api/admin/impersonate/[userId]/route.ts — старт режима поддержки
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

const GRANT_TTL_SEC = 120;

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  if (session.impersonatedBy) {
    return NextResponse.json({ error: { code: 'ALREADY_IMPERSONATING', message: 'Сначала выйдите из текущего режима', statusCode: 409 } }, { status: 409 });
  }

  const role = session.user.role;
  const supportLevel = session.user.supportLevel ?? null;
  const canImpersonate = role === 'admin' || (role === 'support' && (supportLevel === 'view' || supportLevel === 'full'));
  if (!canImpersonate) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Недостаточно прав', statusCode: 403 } }, { status: 403 });
  }

  try {
    const { userId } = await params;
    if (userId === session.user.id) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Нельзя войти в свой аккаунт', statusCode: 403 } }, { status: 403 });
    }
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!target) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Пользователь не найден', statusCode: 404 } }, { status: 404 });
    }
    if (target.role === 'admin') {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Нельзя войти в аккаунт администратора', statusCode: 403 } }, { status: 403 });
    }

    const level: 'view' | 'full' = role === 'admin' ? 'full' : (supportLevel as 'view' | 'full');
    const exp = Date.now() + GRANT_TTL_SEC * 1000;
    await redis.setex(`impersonation-grant:${session.user.id}`, GRANT_TTL_SEC, JSON.stringify({ targetUserId: userId, level, exp }));

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    await prisma.adminAuditLog.create({
      data: { adminId: session.user.id, action: 'impersonate_start', targetUserId: userId, level, ip },
    });

    return NextResponse.json({ data: { ok: true, level } });
  } catch (e) {
    return apiError(e, 'POST /api/admin/impersonate/[userId]');
  }
}
