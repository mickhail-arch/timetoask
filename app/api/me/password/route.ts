// app/api/me/password/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { changePassword } from '@/modules/user/user.service';
import { unauthorized, apiError } from '@/lib/api-helpers';

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  try {
    const { oldPassword, newPassword } = schema.parse(await req.json());
    await changePassword(session.user.id, oldPassword, newPassword);
    return NextResponse.json({ data: { success: true } });
  } catch (e) { return apiError(e, 'PATCH /api/me/password'); }
}
