'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Пароль слишком простой. Используйте не менее 8 символов, включая буквы и цифры')
      .regex(
        /(?=.*[a-zA-Zа-яА-Я])(?=.*\d)/,
        'Пароль слишком простой. Используйте не менее 8 символов, включая буквы и цифры',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают. Проверьте введённые данные',
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

export default function PasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('register_email');
    if (!stored) {
      router.replace('/register');
      return;
    }
    setEmail(stored);
  }, [router]);

  async function onSubmit(data: PasswordForm) {
    // TODO: replace stub with real API call when backend supports password creation
    // const res = await fetch('/api/auth/set-password', { method: 'POST', ... });
    // if (!res.ok) { setServerError(...); return; }

    sessionStorage.removeItem('register_email');
    router.push('/dashboard');
  }

  if (!email) return null;

  return (
    <div className="w-full max-w-[400px] px-4">
      <h1 className="mb-8 text-center text-3xl font-bold leading-tight text-text-primary">
        Придумайте пароль
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
          Завершить регистрацию
        </Button>
      </form>
    </div>
  );
}
