// adapters/email/smtp.adapter.ts — SMTP email adapter (fire-and-forget)
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '@/core/config/env';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    await getTransporter().sendMail({
      from: `"${env.APP_NAME}" <${env.SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    console.info(`[email] sent to=${to} subject="${subject}"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[email] failed to=${to} subject="${subject}" error="${message}"`);
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const link = `${env.APP_URL}/verify?token=${token}`;
  await send(
    to,
    'Подтверждение email',
    `<p>Для подтверждения email перейдите по ссылке:</p><p><a href="${link}">${link}</a></p>`,
  );
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const link = `${env.APP_URL}/reset-password?token=${token}`;
  await send(
    to,
    'Сброс пароля',
    `<p>Для сброса пароля перейдите по ссылке:</p><p><a href="${link}">${link}</a></p>`,
  );
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
): Promise<void> {
  await send(
    to,
    `Добро пожаловать в ${env.APP_NAME}`,
    `<p>Здравствуйте, ${name}!</p><p>Добро пожаловать в ${env.APP_NAME}. Мы рады видеть вас!</p>`,
  );
}

export async function sendBalanceLowEmail(
  to: string,
  currentBalance: string,
): Promise<void> {
  await send(
    to,
    'Низкий баланс',
    `<p>Ваш текущий баланс: ${currentBalance}. Рекомендуем пополнить счёт, чтобы продолжить использование сервиса.</p>`,
  );
}
