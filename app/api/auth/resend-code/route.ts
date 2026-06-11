import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resendVerificationCode } from '@/modules/auth/auth.service';
import { TooManyRequestsError } from '@/core/errors';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const within = await rateLimit(`resend:${ip}`, 10, 3600);
    if (!within) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_REQUESTS', message: 'Слишком много запросов. Попробуйте позже', statusCode: 429 } },
        { status: 429 },
      );
    }

    const body = schema.parse(await req.json());
    await resendVerificationCode(body.email);
    return NextResponse.json({ data: { sent: true } }, { status: 200 });
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
    console.error('[POST /api/auth/resend-code]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Что-то пошло не так', statusCode: 500 } },
      { status: 500 },
    );
  }
}
