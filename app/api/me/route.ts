// app/api/me/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProfile, updateProfile, deleteAccount } from '@/modules/user/user.service';
import { unauthorized, apiError } from '@/lib/api-helpers';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  try {
    const user = await getProfile(session.user.id);
    return NextResponse.json({ data: user });
  } catch (e) { return apiError(e, 'GET /api/me'); }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  try {
    const data = patchSchema.parse(await req.json());
    const user = await updateProfile(session.user.id, data);
    return NextResponse.json({ data: user });
  } catch (e) { return apiError(e, 'PATCH /api/me'); }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  try {
    await deleteAccount(session.user.id);
    return NextResponse.json({ data: { success: true } });
  } catch (e) { return apiError(e, 'DELETE /api/me'); }
}
