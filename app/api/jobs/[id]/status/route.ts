// app/api/jobs/[id]/status/route.ts — статус job с поддержкой SEO-пайплайна
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getJobStatus } from '@/modules/llm/tool-execution.service';
import { getRedisState } from '@/modules/seo/pipeline';
import { unauthorized, apiError } from '@/lib/api-helpers';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  const { id } = await params;

  try {
    // Сначала проверить Redis (SEO-пайплайн, быстрый ответ)
    const redisState = await getRedisState(id);
    if (redisState) {
      return NextResponse.json({ data: redisState });
    }

    // Fallback на стандартный PG job status
    const data = await getJobStatus(id, session.user.id);
    return NextResponse.json({ data });
  } catch (e) {
    return apiError(e, 'GET /api/jobs/[id]/status');
  }
}
