import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 } },
      { status: 401 },
    );
  }

  const body = await req.json();
  const { toolSlug, title, inputParams, outputMeta, contentText, tokensUsed, durationSec, parentId } = body;

  if (!toolSlug || !title) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'toolSlug and title are required', statusCode: 400 } },
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

  let version = 1;
  if (parentId) {
    const parent = await prisma.toolSession.findUnique({
      where: { id: parentId },
      select: { version: true },
    });
    version = (parent?.version ?? 0) + 1;
  }

  const toolSession = await prisma.toolSession.create({
    data: {
      userId: session.user.id,
      toolId: tool.id,
      parentId: parentId ?? null,
      title: parentId ? `${title} v${version}` : title,
      status: 'completed',
      inputParams: inputParams ?? {},
      outputMeta: outputMeta ?? {},
      contentText: contentText ?? null,
      tokensUsed: tokensUsed ?? 0,
      durationSec: durationSec ?? 0,
      version,
    },
  });

  return NextResponse.json({ data: { id: toolSession.id } });
}
