import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unauthorized, apiError } from '@/lib/api-helpers';

interface Manifest {
  output_format?: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  const { slug } = await params;

  if (!/^[\w-]+$/.test(slug)) {
    return NextResponse.json(
      { error: { code: 'INVALID_SLUG', message: 'Invalid tool slug', statusCode: 400 } },
      { status: 400 },
    );
  }

  try {
    const tool = await prisma.tool.findUnique({ where: { slug } });
    if (!tool) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Tool not found', statusCode: 404 } },
        { status: 404 },
      );
    }

    let outputFormat = 'json';
    try {
      const manifestPath = join(process.cwd(), 'plugins', slug, 'manifest.json');
      const raw = await readFile(manifestPath, 'utf-8');
      const manifest: Manifest = JSON.parse(raw);
      outputFormat = manifest.output_format ?? 'json';
    } catch {
      // manifest may not exist for all tools
    }

    return NextResponse.json({
      data: {
        id: tool.id,
        slug: tool.slug,
        name: tool.name,
        description: tool.description,
        model: tool.model,
        status: tool.status,
        executionMode: tool.executionMode,
        tokenCost: tool.tokenCost,
        freeUsesLimit: tool.freeUsesLimit,
        version: tool.version,
        outputFormat,
      },
    });
  } catch (e) {
    return apiError(e, 'GET /api/tools/[slug]');
  }
}
