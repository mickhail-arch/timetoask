// app/api/ai/section/route.ts — общая AI-генерация раздела статьи
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { reserveTokens, finalizeTokens, rollbackTokens } from '@/modules/billing/billing.service';
import { generateSection } from '@/modules/section-generator';
import { calculateSectionPrice, SECTION_RANGES, type SectionModel } from '@/modules/section-generator/pricing';
import { InsufficientBalanceError } from '@/core/errors';

const schema = z.object({
  heading: z.string().min(3).max(200),
  level: z.enum(['h2', 'h3']),
  targetChars: z.number().int(),
  model: z.enum(['sonnet', 'gemini', 'opus']),
  articleTitle: z.string().max(300).optional(),
  contextBefore: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  try {
    const body = schema.parse(await req.json());
    const range = SECTION_RANGES[body.level];
    const chars = Math.min(range.max, Math.max(range.min, body.targetChars));
    const model = body.model as SectionModel;
    const userId = session.user.id;
    const cost = calculateSectionPrice(chars, model);
    const idempotencyKey = `ai-section:${userId}:${Date.now()}`;

    try {
      await prisma.$transaction(async (tx) => {
        await reserveTokens(userId, cost, idempotencyKey, tx);
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: { code: 'INSUFFICIENT_BALANCE', message: `Недостаточно токенов. Нужно: ${cost}`, statusCode: 402 } },
          { status: 402 },
        );
      }
      throw err;
    }

    let html: string;
    try {
      html = await generateSection({
        heading: body.heading,
        level: body.level,
        targetChars: chars,
        model,
        articleTitle: body.articleTitle,
        contextBefore: body.contextBefore,
        userId,
      });
    } catch (genErr) {
      await prisma.$transaction(async (tx) => {
        await rollbackTokens(userId, cost, tx);
      }, { isolationLevel: 'Serializable' });
      throw genErr;
    }

    await prisma.$transaction(async (tx) => {
      await finalizeTokens(userId, cost, tx);
    }, { isolationLevel: 'Serializable' });

    return NextResponse.json({ data: { html, price: cost } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: e.errors[0].message, statusCode: 400 } },
        { status: 400 },
      );
    }
    return apiError(e, 'POST /api/ai/section');
  }
}
