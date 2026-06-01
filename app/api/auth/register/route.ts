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
    .max(72, 'Максимум 72 символа')
    .regex(/^[A-Za-z0-9!@#$%^&*(),.?":{}|<>]+$/, 'Только латиница, цифры и символы')
    .regex(/[A-Z]/, 'Нужна заглавная буква')
    .regex(/[a-z]/, 'Нужна строчная буква')
    .regex(/[0-9]/, 'Нужна цифра')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Нужен спецсимвол'),
  name: z.string().min(1, 'Введите имя').max(100),
});

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await req.json());
    const user = await register(body.email, body.password, body.name);
    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors[0].message, statusCode: 400 } },
        { status: 400 },
      );
    }
    if (error instanceof ValidationError) {
      if (error.message === 'EMAIL_EXISTS_VERIFIED') {
        return NextResponse.json(
          { error: { code: 'EMAIL_EXISTS', message: 'Аккаунт с таким email уже существует', statusCode: 409 } },
          { status: 409 },
        );
      }
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