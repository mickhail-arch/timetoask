import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resendVerificationCode } from '@/modules/auth/auth.service';

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  try {
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
    console.error('[POST /api/auth/resend-code]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Что-то пошло не так', statusCode: 500 } },
      { status: 500 },
    );
  }
}
