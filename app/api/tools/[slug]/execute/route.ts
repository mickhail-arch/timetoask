import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { ToolRegistry } from '@/plugins/registry';
import { executeSync, executeAsync } from '@/modules/llm/tool-execution.service';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorized();
    const { slug } = await params;
    const tool = await ToolRegistry.resolve(slug);
    if (!tool) return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Tool not found', statusCode: 404 } }, { status: 404 });
    const body = await req.json();
    const input = tool.buildUserMessage(body);
    if (tool.executionMode === 'async') {
      const result = await executeAsync(session.user.id, tool, input);
      return NextResponse.json({ data: result });
    }
    const stream = new ReadableStream({
      async start(c) {
        for await (const chunk of executeSync(session.user.id, tool, input))
          c.enqueue(new TextEncoder().encode(chunk));
        c.close();
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (e) {
    return apiError(e, 'POST /api/tools/[slug]/execute');
  }
}
