// app/api/admin/users/[id]/access/route.ts — назначение уровня поддержки (только admin)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { setUserAccess } from '@/modules/admin/admin.service';

const schema = z.object({ access: z.enum(['none', 'view', 'full']) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Недостаточно прав', statusCode: 403 } }, { status: 403 });
  }
  try {
    const { id } = await params;
    const { access } = schema.parse(await req.json());
    const user = await setUserAccess(id, access);
    await prisma.adminAuditLog.create({
      data: {
        adminId: session.user.id,
        action: access === 'none' ? 'revoke_access' : 'grant_access',
        targetUserId: id,
        level: access === 'none' ? null : access,
      },
    });
    return NextResponse.json({ data: user });
  } catch (e) {
    return apiError(e, 'PATCH /api/admin/users/[id]/access');
  }
}
