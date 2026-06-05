// app/api/jobs/[id]/cancel/route.ts — отмена генерации
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { cancelJob } from '@/modules/seo/pipeline';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  try {
    const { id } = await params;
    await cancelJob(id, session.user.id);
    return NextResponse.json({ data: { cancelled: true } });
  } catch (e) {
    return apiError(e, 'POST /api/jobs/[id]/cancel');
  }
}
