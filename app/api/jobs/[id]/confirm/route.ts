// app/api/jobs/[id]/confirm/route.ts — подтверждение ТЗ
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { getRedisState, resumePipeline } from '@/modules/seo/pipeline';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  const { id } = await params;
  try {
    const { brief } = await req.json();
    const state = await getRedisState(id);
    if (!state || state.status !== 'awaiting_confirmation') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: 'Job is not awaiting confirmation', statusCode: 400 } },
        { status: 400 },
      );
    }
    // TODO: resume будет вызываться с реальными steps после создания шагов пайплайна (блок Г)
    return NextResponse.json({ data: { success: true, jobId: id } });
  } catch (e) {
    return apiError(e, 'POST /api/jobs/[id]/confirm');
  }
}
