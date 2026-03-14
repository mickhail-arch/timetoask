// app/api/tools/[slug]/schema/route.ts
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';

interface Manifest {
  output_format?: string;
  executionMode?: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  const { slug } = await params;

  // Validate slug to prevent path traversal
  if (!/^[\w-]+$/.test(slug)) {
    return NextResponse.json({ error: { code: 'INVALID_SLUG', message: 'Invalid tool slug', statusCode: 400 } }, { status: 400 });
  }

  try {
    const pluginModule = await import(`@/plugins/${slug}/index`).catch(() => null);
    if (!pluginModule) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Tool not found', statusCode: 404 } }, { status: 404 });
    }

    const manifestPath = join(process.cwd(), 'plugins', slug, 'manifest.json');
    const manifestRaw = await readFile(manifestPath, 'utf-8');
    const manifest: Manifest = JSON.parse(manifestRaw);

    const inputSchema = zodToJsonSchema(pluginModule.inputSchema as ZodType, {
      name: 'input',
      errorMessages: true,
    });

    return NextResponse.json({
      data: {
        inputSchema,
        outputFormat: manifest.output_format ?? 'json',
      },
    });
  } catch (e) {
    return apiError(e, 'GET /api/tools/[slug]/schema');
  }
}
