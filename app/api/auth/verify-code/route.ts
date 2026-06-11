import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCode } from '@/modules/auth/auth.service';
import { ValidationError, TooManyRequestsError } from '@/core/errors';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const within = await rateLimit(`verify:${ip}`, 30, 15 * 60);
    if (!within) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_REQUESTS', message: 'Слишком много попыток. Попробуйте позже', statusCode: 429 } },
        { status: 429 },
      );
    }
    const body = schema.parse(await req.json());
    await verifyCode(body.email, body.code);
    return NextResponse.json({ data: { verified: true } }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors[0].message, statusCode: 400 } },
        { status: 400 },
      );
    }
    if (error instanceof TooManyRequestsError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, statusCode: 429 } },
        { status: 429 },
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: 'Неверный или просроченный код', statusCode: 400 } },
        { status: 400 },
      );
    }
    console.error('[POST /api/auth/verify-code]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Что-то пошло не так', statusCode: 500 } },
      { status: 500 },
    );
  }
}
