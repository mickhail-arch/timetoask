// app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { register } from '@/modules/auth/auth.service';
import { ValidationError } from '@/core/errors';

const registerSchema = z.object({
  email: z.string().email('Невалидный email'),
  password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .regex(/[A-Z]/, 'Нужна хотя бы одна заглавная буква')
    .regex(/[a-z]/, 'Нужна хотя бы одна строчная буква')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Нужен хотя бы один спецсимвол'),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await req.json());
    const user = await register(body.email, body.password, body.name ?? '');
    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors[0].message, statusCode: 400 } },
        { status: 400 },
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, statusCode: 400 } },
        { status: 400 },
      );
    }
    console.error('[POST /api/auth/register]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Что-то пошло не так', statusCode: 500 } },
      { status: 500 },
    );
  }
}