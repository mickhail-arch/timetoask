'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const verifySchema = z.object({
  code: z.string().min(1, 'Введите код'),
});

type VerifyForm = z.infer<typeof verifySchema>;

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [serverError, setServerError] = useState('');
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('register_email');
    if (!stored) {
      router.replace('/register');
      return;
    }
    setEmail(stored);
  }, [router]);

  async function onSubmit(data: VerifyForm) {
    setServerError('');

    // TODO: replace stub with real API call when backend supports email verification
    // const res = await fetch('/api/auth/verify-email', { method: 'POST', ... });
    // if (!res.ok) { setServerError('Неверный код'); return; }

    router.push('/register/password');
  }

  async function handleResend() {
    setResending(true);
    // TODO: POST /api/auth/resend-code with { email }
    try {
      await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Backend not ready
    }
    setResending(false);
  }

  if (!email) return null;

  return (
    <div className="w-full max-w-[400px] px-4">
      <h1 className="mb-2 text-center text-3xl font-bold leading-tight text-text-primary">
        Подтвердите email
      </h1>
      <p className="mb-8 text-center text-sm text-text-secondary">
        Мы отправили код подтверждения на {email}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Код из письма"
          inputMode="numeric"
          autoComplete="one-time-code"
          error={errors.code?.message || serverError || undefined}
          {...register('code')}
        />

        <Button
          type="submit"
          variant="accent"
          fullWidth
          loading={isSubmitting}
        >
          Подтвердить
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Нет письма?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-text-link hover:underline disabled:opacity-50"
        >
          Отправить повторно
        </button>
      </p>
    </div>
  );
}
