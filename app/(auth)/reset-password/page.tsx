//app/(auth)/reset-password/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const schema = z
  .object({
    password: z.string().min(8, 'Пароль должен содержать не менее 8 символов'),
    confirm: z.string().min(1, 'Подтвердите пароль'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  });

type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (!token) {
    return (
      <div className="w-full max-w-[400px] px-4 text-center">
        <p className="mb-4 text-text-primary">Ссылка некорректна.</p>
        <Link href="/forgot-password" className="font-medium text-text-link hover:underline text-sm">
          Запросить новую ссылку
        </Link>
      </div>
    );
  }

  async function onSubmit(data: FormData) {
    setServerError('');
    const res = await fetch('/api/auth/reset-password/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: data.password }),
    });

    if (res.ok) {
      setSuccess(true);
      return;
    }

    const body = await res.json().catch(() => ({}));
    setServerError(body?.error?.message || 'Произошла ошибка. Попробуйте снова.');
  }

  return (
    <div className="w-full max-w-[400px] px-4">
      <h1 className="mb-8 text-center text-3xl font-bold leading-tight text-text-primary">
        Новый пароль
      </h1>

      {success ? (
        <>
          <p className="mb-6 rounded-lg bg-accent/10 p-4 text-sm text-text-primary text-center">
            Пароль изменён.
          </p>
          <p className="text-center text-sm text-text-secondary">
            <Link href="/login" className="font-medium text-text-link hover:underline">
              Войти
            </Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Новый пароль"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Input
            label="Подтверждение пароля"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register('confirm')}
          />

          {serverError && (
            <p className="text-sm text-red-500">{serverError}</p>
          )}

          <Button
            type="submit"
            variant="accent"
            fullWidth
            loading={isSubmitting}
          >
            Сохранить пароль
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
