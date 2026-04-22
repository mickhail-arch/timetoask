//app/api/sessions/save/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 } },
      { status: 401 },
    );
  }

  const rawBody = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON', statusCode: 400 } },
      { status: 400 },
    );
  }
  const toolSlug = body.toolSlug as string | undefined;
  const title = body.title as string | undefined;
  const inputParams = (body.inputParams ?? {}) as Record<string, unknown>;
  const outputMeta = (body.outputMeta ?? {}) as Record<string, unknown>;
  const contentText = (body.contentText as string) ?? null;
  const tokensUsed = (body.tokensUsed as number) ?? 0;
  const durationSec = (body.durationSec as number) ?? 0;
  const parentId = (body.parentId as string) ?? null;

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
      status: (body.status as string) ?? 'completed',
      inputParams: (inputParams ?? {}) as Prisma.InputJsonValue,
      outputMeta: (outputMeta ?? {}) as Prisma.InputJsonValue,
      contentText: contentText ?? null,
      tokensUsed: tokensUsed ?? 0,
      durationSec: durationSec ?? 0,
      version,
    },
  });

  return NextResponse.json({ data: { id: toolSession.id } });
}
