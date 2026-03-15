'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const registerSchema = z.object({
  email: z.string().email('Введите корректный email'),
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

    // TODO: replace stub with real API call when backend supports single-step email registration
    // const res = await fetch('/api/auth/register', { method: 'POST', ... });
    // if (res.status === 409) { setServerError('Аккаунт с таким email уже существует'); return; }

    sessionStorage.setItem('register_email', data.email);
    router.push('/register/verify');
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

        <Button
          type="submit"
          variant="accent"
          fullWidth
          loading={isSubmitting}
        >
          Регистрация
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
