import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/sessions?toolSlug=seo-article-express&limit=50
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const toolSlug = searchParams.get('toolSlug') ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

  if (!toolSlug) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'toolSlug is required', statusCode: 400 } },
      { status: 400 },
    );
  }

  const tool = await prisma.tool.findUnique({ where: { slug: toolSlug } });
  if (!tool) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Tool not found', statusCode: 404 } },
      { status: 404 },
    );
  }

  const sessions = await prisma.toolSession.findMany({
    where: {
      userId: session.user.id,
      toolId: tool.id,
    },
    select: {
      id: true,
      title: true,
      status: true,
      version: true,
      parentId: true,
      tokensUsed: true,
      durationSec: true,
      outputMeta: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ data: sessions });
}
