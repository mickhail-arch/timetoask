//app/api/tools/rewrite-fragment/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateAndMeter } from '@/modules/llm/meter';
import { calculateRewritePrice } from '@/modules/billing/model-pricing';
import { reserveTokens, finalizeTokens, rollbackTokens } from '@/modules/billing/billing.service';
import { acquireIdempotency, releaseIdempotency } from '@/lib/idempotency';
import { createHash } from 'node:crypto';
import { InsufficientBalanceError, DuplicateRequestError } from '@/core/errors';
import { readJson } from '@/lib/read-json';
import { apiError } from '@/lib/api-helpers';

const MODEL = 'anthropic/claude-opus-4-8';

const schema = z.object({
  fragment: z.string().min(1).max(3000),
  userPrompt: z.string().min(1).max(300),
  contextBefore: z.string().max(5000).optional(),
  contextAfter: z.string().max(5000).optional(),
  sectionTitle: z.string().max(5000).optional(),
  articleTitle: z.string().max(5000).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 } },
      { status: 401 },
    );
  }

  try {
    const { fragment, contextBefore, contextAfter, sectionTitle, articleTitle, userPrompt } =
      schema.parse(await readJson(req));

    const userId = session.user.id;
    const price = calculateRewritePrice(fragment.length);

    const dedupeKey = `rewrite:${userId}:${createHash('sha1')
      .update(fragment + userPrompt)
      .digest('hex')
      .slice(0, 16)}`;
    const idempotencyKey = `rewrite:${userId}:${Date.now()}`;

    const fresh = await acquireIdempotency(dedupeKey);
    if (!fresh) throw new DuplicateRequestError();

    try {
      await prisma.$transaction(async (tx) => {
        await reserveTokens(userId, price, idempotencyKey, tx);
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      await releaseIdempotency(dedupeKey);
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: { code: 'INSUFFICIENT_BALANCE', message: `Недостаточно средств. Нужно: ${price} ₽`, statusCode: 402 } },
          { status: 402 },
        );
      }
      throw err;
    }

    const minChars = Math.round(fragment.length * 0.7);
    const maxChars = Math.round(fragment.length * 1.3);

    const systemPrompt = `Ты — профессиональный редактор текста. Перепиши ТОЛЬКО предоставленный фрагмент по инструкции пользователя.

ЖЁСТКИЕ ПРАВИЛА:
1. Верни ТОЛЬКО переписанный фрагмент — без пояснений, без кавычек, без комментариев.
2. Объём результата: строго от ${minChars} до ${maxChars} символов (оригинал: ${fragment.length} символов).
3. НЕ добавляй новые разделы, заголовки H2/H3, списки, если пользователь не просил.
4. НЕ меняй структуру (если был абзац — останется абзац, если был пункт списка — останется пункт).
5. Сохрани HTML-разметку: теги <p>, <strong>, <em>, <a>, <ul>, <li> оставь как есть или адаптируй минимально.
6. Сохрани все ссылки <a href="..."> из оригинала.
7. Если пользователь просит увеличить объём — максимум +30%. Если сократить — минимум -30%.
8. Пиши на русском языке. Стиль и тон должны совпадать с окружающим контекстом.

Контекст статьи:
- Заголовок: ${articleTitle}
- Раздел: ${sectionTitle}
- Текст ДО фрагмента: ...${(contextBefore ?? '').slice(-500)}
- Текст ПОСЛЕ фрагмента: ${(contextAfter ?? '').slice(0, 500)}...`;

    const userMessage = `Фрагмент для переписывания:
${fragment}

Задача: ${userPrompt}`;

    let rewritten: string;
    try {
      const result = await generateAndMeter({
        model: MODEL,
        systemPrompt,
        userMessage,
        maxOutputTokens: Math.max(500, Math.ceil(fragment.length * 0.5)),
      }, { userId, feature: 'rewrite' });

      rewritten = result.replace(/^```html\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    } catch (genErr) {
      await prisma.$transaction(async (tx) => {
        await rollbackTokens(userId, price, tx, idempotencyKey);
      }, { isolationLevel: 'Serializable' });
      await releaseIdempotency(dedupeKey);
      const message = genErr instanceof Error ? genErr.message : 'Rewrite failed';
      return NextResponse.json(
        { error: { code: 'LLM_UNAVAILABLE', message, statusCode: 503 } },
        { status: 503 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await finalizeTokens(userId, price, tx, idempotencyKey);
    }, { isolationLevel: 'Serializable' });

    return NextResponse.json({
      data: {
        rewritten,
        originalLength: fragment.length,
        rewrittenLength: rewritten.replace(/<[^>]*>/g, '').length,
        price,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: e.errors[0].message, statusCode: 400 } },
        { status: 400 },
      );
    }
    return apiError(e, 'POST /api/tools/rewrite-fragment');
  }
}
