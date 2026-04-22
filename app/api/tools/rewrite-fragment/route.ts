import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateText } from '@/adapters/llm/openrouter.adapter';

const MODEL = 'anthropic/claude-opus-4-7';
const PRICE_PER_100_CHARS = 0.7;
const MIN_PRICE = 3;

function calculateRewritePrice(charCount: number): number {
  return Math.max(MIN_PRICE, Math.ceil(charCount / 100) * PRICE_PER_100_CHARS);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 } },
      { status: 401 },
    );
  }

  const body = await req.json();
  const { fragment, contextBefore, contextAfter, sectionTitle, articleTitle, userPrompt } = body as {
    fragment: string;
    contextBefore: string;
    contextAfter: string;
    sectionTitle: string;
    articleTitle: string;
    userPrompt: string;
  };

  if (!fragment || !userPrompt) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'fragment and userPrompt are required', statusCode: 400 } },
      { status: 400 },
    );
  }

  if (userPrompt.length > 300) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Prompt must be 300 characters or less', statusCode: 400 } },
      { status: 400 },
    );
  }

  if (fragment.length > 3000) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Fragment must be 3000 characters or less', statusCode: 400 } },
      { status: 400 },
    );
  }

  const price = calculateRewritePrice(fragment.length);
  const balance = await prisma.balance.findUnique({ where: { userId: session.user.id } });
  if (!balance || Number(balance.amount) < price) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_BALANCE', message: `Недостаточно средств. Нужно: ${price} ₽, доступно: ${Number(balance?.amount ?? 0)} ₽`, statusCode: 402 } },
      { status: 402 },
    );
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

  try {
    const result = await generateText({
      model: MODEL,
      systemPrompt,
      userMessage,
      maxOutputTokens: Math.max(500, Math.ceil(fragment.length * 0.5)),
    });

    const rewritten = result.replace(/^```html\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    await prisma.balance.update({
      where: { userId: session.user.id },
      data: { amount: { decrement: price } },
    });

    return NextResponse.json({
      data: {
        rewritten,
        originalLength: fragment.length,
        rewrittenLength: rewritten.replace(/<[^>]*>/g, '').length,
        price,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rewrite failed';
    return NextResponse.json(
      { error: { code: 'LLM_UNAVAILABLE', message, statusCode: 503 } },
      { status: 503 },
    );
  }
}
