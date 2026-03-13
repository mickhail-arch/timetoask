// modules/notifications/notifications.service.ts — Notification facade over adapters
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBalanceLowEmail,
} from '@/adapters/email/smtp.adapter';

export async function notifyEmailVerification(
  to: string,
  token: string,
): Promise<void> {
  await sendVerificationEmail(to, token);
}

export async function notifyPasswordReset(
  to: string,
  token: string,
): Promise<void> {
  await sendPasswordResetEmail(to, token);
}

export async function notifyBalanceLow(
  to: string,
  currentBalance: string,
): Promise<void> {
  await sendBalanceLowEmail(to, currentBalance);
}
