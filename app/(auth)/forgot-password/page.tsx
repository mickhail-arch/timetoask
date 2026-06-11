//app/(auth)/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setRateLimited(false);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email }),
    });

    if (res.status === 429) {
      setRateLimited(true);
      return;
    }

    setSent(true);
  }

  return (
    <div className="w-full max-w-[400px] px-4">
      <h1 className="mb-8 text-center text-3xl font-bold leading-tight text-text-primary">
        Сброс пароля
      </h1>

      {sent ? (
        <p className="mb-6 rounded-lg bg-accent/10 p-4 text-sm text-text-primary text-center">
          Если аккаунт существует, мы отправили письмо со ссылкой для сброса пароля.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          {rateLimited && (
            <p className="text-sm text-red-500">
              Слишком много попыток. Пожалуйста, подождите и попробуйте снова.
            </p>
          )}

          <Button
            type="submit"
            variant="accent"
            fullWidth
            loading={isSubmitting}
          >
            Отправить ссылку
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-text-secondary">
        <Link href="/login" className="font-medium text-text-link hover:underline">
          Вернуться ко входу
        </Link>
      </p>
    </div>
  );
}
