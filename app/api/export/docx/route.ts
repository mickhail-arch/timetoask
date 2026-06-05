// app/api/export/docx/route.ts — общий эндпоинт выгрузки HTML → .docx
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { generateDocxBuffer } from '@/modules/export';

const schema = z.object({
  html: z.string().min(1),
  title: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  try {
    const { html, title } = schema.parse(await req.json());
    const buffer = await generateDocxBuffer({ html, title });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: e.errors[0].message, statusCode: 400 } }, { status: 400 });
    }
    return apiError(e, 'POST /api/export/docx');
  }
}
