'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const registerSchema = z
  .object({
    email: z.string().email('Введите корректный email'),
    password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .regex(/[A-Z]/, 'Нужна хотя бы одна заглавная буква')
      .regex(/[a-z]/, 'Нужна хотя бы одна строчная буква')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Нужен хотя бы один спецсимвол'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterForm) {
    setServerError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email, password: data.password }),
    });
    if (!res.ok) {
      const json = await res.json();
      if (res.status === 409) {
        setServerError('Аккаунт с таким email уже существует');
      } else {
        setServerError(json.error?.message ?? 'Что-то пошло не так');
      }
      return;
    }
    router.push('/login?registered=1');
  }

  return (
    <div className="w-full max-w-[400px] px-4">
      <h1 className="mb-8 text-center text-3xl font-bold leading-tight text-text-primary">
        Регистрация в Таймтуаск
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message || serverError || undefined}
          {...register('email')}
        />

        <Input
          label="Пароль"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Повторить пароль"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button
          type="submit"
          variant="accent"
          fullWidth
          loading={isSubmitting}
        >
          Зарегистрироваться
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="font-medium text-text-link hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
