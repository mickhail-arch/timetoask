// app/api/ai/keywords/route.ts — общая AI-генерация SEO-ключей
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { reserveTokens, finalizeTokens, rollbackTokens } from '@/modules/billing/billing.service';
import { generateKeywords } from '@/modules/keywords';
import { KEYWORDS_GENERATION_COST } from '@/core/constants';
import { acquireIdempotency, releaseIdempotency } from '@/lib/idempotency';
import { createHash } from 'node:crypto';
import { InsufficientBalanceError, DuplicateRequestError } from '@/core/errors';

const schema = z.object({
  topic: z.string().min(3).max(300),
  existing: z.array(z.string()).max(50).optional(),
  intent: z.string().max(50).optional(),
  geo: z.string().max(200).optional(),
  forbidden: z.array(z.string()).max(50).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { topic, existing, intent, geo, forbidden } = schema.parse(await req.json());
    const cost = KEYWORDS_GENERATION_COST;
    const userId = session.user.id;
    const dedupeKey = `ai-keywords:${userId}:${createHash('sha1')
      .update(JSON.stringify({ topic, existing, intent, geo, forbidden }))
      .digest('hex')
      .slice(0, 16)}`;
    const idempotencyKey = `ai-keywords:${userId}:${Date.now()}`;

    const fresh = await acquireIdempotency(dedupeKey);
    if (!fresh) throw new DuplicateRequestError();

    try {
      await prisma.$transaction(async (tx) => {
        await reserveTokens(userId, cost, idempotencyKey, tx);
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      await releaseIdempotency(dedupeKey);
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: { code: 'INSUFFICIENT_BALANCE', message: `Недостаточно токенов. Нужно: ${cost}`, statusCode: 402 } },
          { status: 402 },
        );
      }
      throw err;
    }

    let keywords: string[];
    try {
      keywords = await generateKeywords(topic, existing ?? [], { intent, geo, forbidden }, userId);
    } catch (genErr) {
      await prisma.$transaction(async (tx) => {
        await rollbackTokens(userId, cost, tx, idempotencyKey);
      }, { isolationLevel: 'Serializable' });
      await releaseIdempotency(dedupeKey);
      throw genErr;
    }

    await prisma.$transaction(async (tx) => {
      await finalizeTokens(userId, cost, tx, idempotencyKey);
    }, { isolationLevel: 'Serializable' });

    return NextResponse.json({ data: { keywords } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: e.errors[0].message, statusCode: 400 } },
        { status: 400 },
      );
    }
    return apiError(e, 'POST /api/ai/keywords');
  }
}
