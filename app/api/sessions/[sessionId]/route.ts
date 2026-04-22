import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/sessions/:sessionId
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 } },
      { status: 401 },
    );
  }

  const { sessionId } = await params;

  const toolSession = await prisma.toolSession.findUnique({
    where: { id: sessionId },
  });

  if (!toolSession || toolSession.userId !== session.user.id) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Session not found', statusCode: 404 } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: toolSession });
}

// DELETE /api/sessions/:sessionId
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 } },
      { status: 401 },
    );
  }

  const { sessionId } = await params;

  const toolSession = await prisma.toolSession.findUnique({
    where: { id: sessionId },
  });

  if (!toolSession || toolSession.userId !== session.user.id) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Session not found', statusCode: 404 } },
      { status: 404 },
    );
  }

  await prisma.toolSession.delete({ where: { id: sessionId } });

  return NextResponse.json({ data: { deleted: true } });
}

// PATCH /api/sessions/:sessionId
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 } },
      { status: 401 },
    );
  }

  const { sessionId } = await params;

  const toolSession = await prisma.toolSession.findUnique({
    where: { id: sessionId },
  });

  if (!toolSession || toolSession.userId !== session.user.id) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Session not found', statusCode: 404 } },
      { status: 404 },
    );
  }

  const body = await req.json();
  const { contentText, outputMeta } = body;

  const updateData: Record<string, unknown> = {};
  if (contentText !== undefined) updateData.contentText = contentText;
  if (outputMeta !== undefined) updateData.outputMeta = outputMeta;
  if (body.title !== undefined) updateData.title = body.title;
  if (body.inputParams !== undefined) updateData.inputParams = body.inputParams;
  if (body.status !== undefined) updateData.status = body.status;

  const updated = await prisma.toolSession.update({
    where: { id: sessionId },
    data: updateData,
  });

  return NextResponse.json({ data: updated });
}
