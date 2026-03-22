// app/api/jobs/[id]/confirm/route.ts — подтверждение ТЗ
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { getRedisState, resumePipeline } from '@/modules/seo/pipeline';
import { seoExpressSteps, RESUME_FROM_INDEX } from '@/modules/seo/steps';
import { ToolRegistry } from '@/plugins/registry';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  const { id } = await params;

  try {
    const { brief, user_edited } = await req.json();

    const state = await getRedisState(id);
    if (!state || state.status !== 'awaiting_confirmation') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: 'Job is not awaiting confirmation', statusCode: 400 } },
        { status: 400 },
      );
    }

    // Получить config из tool
    const tool = await ToolRegistry.resolve('seo-article-express');
    const config = tool?.config as Record<string, unknown> | null;

    // Запустить resume асинхронно
    resumePipeline(
      id,
      session.user.id,
      { ...brief, user_edited: user_edited ?? false },
      config,
      seoExpressSteps,
      RESUME_FROM_INDEX,
    ).catch(err => console.error('[seo-express] Resume pipeline error:', err));

    return NextResponse.json({ data: { success: true, jobId: id } });
  } catch (e) {
    return apiError(e, 'POST /api/jobs/[id]/confirm');
  }
}
