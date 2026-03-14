// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { login } from '@/modules/auth/auth.service';
import { UnauthorizedError, TooManyRequestsError } from '@/core/errors';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    const user = await login(body.email, body.password);
    return NextResponse.json({ data: { user } }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors[0].message, statusCode: 400 } },
        { status: 400 },
      );
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, statusCode: 401 } },
        { status: 401 },
      );
    }
    if (error instanceof TooManyRequestsError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, statusCode: 429 } },
        { status: 429 },
      );
    }
    console.error('[POST /api/auth/login]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Что-то пошло не так', statusCode: 500 } },
      { status: 500 },
    );
  }
}
