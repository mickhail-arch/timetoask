// app/api/admin/users/[id]/access/route.ts — назначение уровня поддержки (только admin)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, apiError } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { setUserAccess } from '@/modules/admin/admin.service';

const schema = z.object({ access: z.enum(['none', 'view', 'full']) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;
  const { session } = guard;
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
