'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const registerSchema = z
  .object({
    name: z.string().min(1, 'Введите имя').max(100),
    email: z.string().email('Введите корректный email'),
    password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .max(72, 'Максимум 72 символа')
      .regex(/^[A-Za-z0-9!@#$%^&*(),.?":{}|<>]+$/, 'Только латиница, цифры и символы')
      .regex(/[A-Z]/, 'Нужна заглавная буква')
      .regex(/[a-z]/, 'Нужна строчная буква')
      .regex(/[0-9]/, 'Нужна цифра')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Нужен спецсимвол'),
    consent: z.literal(true, {
      errorMap: () => ({ message: 'Необходимо согласие' }),
    }),
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [serverError, setServerError] = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const [creds, setCreds] = useState({ email: '', password: '' });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterForm) {
    setServerError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
    });
    if (!res.ok) {
      const json = await res.json();
      if (res.status === 409) {
        setEmailExists(true);
        setServerError('');
        return;
      }
      setEmailExists(false);
      setServerError(json.error?.message ?? 'Что-то пошло не так');
      return;
    }
    setCreds({ email: data.email, password: data.password });
    setStep('code');
  }

  if (step === 'code') {
    return <CodeStep email={creds.email} password={creds.password} router={router} />;
  }

  return (
    <div className="w-full max-w-[400px] px-4">
      <h1 className="mb-8 text-center text-3xl font-bold leading-tight text-text-primary">
        Регистрация в Таймтуаск
      </h1>

      {emailExists && (
        <div className="mb-4 rounded-lg border border-border bg-bg-input p-3 text-center text-sm text-text-primary">
          Аккаунт с таким email уже существует.{' '}
          <Link href="/login" className="font-medium text-text-link hover:underline">
            Войти
          </Link>{' '}
          или{' '}
          <Link href="/reset-password" className="font-medium text-text-link hover:underline">
            восстановить пароль
          </Link>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Имя" type="text" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message || serverError || undefined} {...register('email')} />
        <Input label="Пароль" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />

        <label className="flex items-start gap-2 text-sm text-text-secondary">
          <input type="checkbox" className="mt-0.5" {...register('consent')} />
          <span>
            Я согласен с{' '}
            <Link href="/privacy" className="text-text-link hover:underline" target="_blank">
              Политикой конфиденциальности
            </Link>
          </span>
        </label>
        {errors.consent && <p className="-mt-2 text-sm text-error">{errors.consent.message}</p>}

        <Button type="submit" variant="accent" fullWidth loading={isSubmitting}>
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

function CodeStep({
  email,
  password,
  router,
}: {
  email: string;
  password: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error?.message ?? 'Неверный код');
      setLoading(false);
      return;
    }
    const signed = await signIn('credentials', { email, password, redirect: false });
    if (signed?.error) {
      router.push('/login?registered=1');
      return;
    }
    router.push('/tools');
  }

  async function resend() {
    setResent(true);
    await fetch('/api/auth/resend-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  }

  return (
    <div className="w-full max-w-[400px] px-4">
      <h1 className="mb-3 text-center text-3xl font-bold leading-tight text-text-primary">
        Подтвердите почту
      </h1>
      <p className="mb-8 text-center text-sm text-text-secondary">
        Мы отправили 6-значный код на {email}
      </p>

      <div className="flex flex-col gap-4">
        <Input
          label="Код из письма"
          type="text"
          inputMode="numeric"
          maxLength={6}
          error={error || undefined}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <Button type="button" variant="accent" fullWidth loading={loading} disabled={code.length !== 6} onClick={submit}>
          Подтвердить
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Не пришёл код?{' '}
        <button type="button" onClick={resend} disabled={resent} className="font-medium text-text-link hover:underline disabled:opacity-50">
          {resent ? 'Отправлено' : 'Отправить снова'}
        </button>
      </p>
      <p className="mt-2 text-center text-sm text-text-secondary">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="font-medium text-text-link hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
