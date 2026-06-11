// modules/referral/referral.service.ts — партнёрская программа (реферальные начисления)
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';

export const REFERRAL_PERCENT = 10;        // % с платной траты реферала
export const REFERRAL_WINDOW_DAYS = 90;    // срок начислений с регистрации реферала
export const ATTRIBUTION_COOKIE_DAYS = 30; // окно атрибуции ссылки

function genCode(): string {
  return (Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)).toLowerCase();
}

/** Вернуть реферальный код юзера, создав при отсутствии. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (u?.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = genCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch { /* коллизия unique — пробуем ещё */ }
  }
  throw new Error('Failed to generate referral code');
}

/** Привязать реферера новому юзеру по коду (в транзакции регистрации). */
export async function attachReferrer(tx: Prisma.TransactionClient, newUserId: string, refCode: string | null): Promise<void> {
  if (!refCode) return;
  const referrer = await tx.user.findUnique({ where: { referralCode: refCode }, select: { id: true } });
  if (!referrer || referrer.id === newUserId) return;
  await tx.user.update({ where: { id: newUserId }, data: { referredById: referrer.id } });
}

/** Начислить рефереру бонус при платной трате реферала (в той же транзакции списания). */
export async function creditReferralOnSpend(tx: Prisma.TransactionClient, spenderId: string, spendAmount: number): Promise<void> {
  if (spendAmount <= 0) return;
  const spender = await tx.user.findUnique({ where: { id: spenderId }, select: { referredById: true, createdAt: true } });
  if (!spender?.referredById) return;

  const ageDays = (Date.now() - spender.createdAt.getTime()) / 86_400_000;
  if (ageDays > REFERRAL_WINDOW_DAYS) return;

  const bonus = Math.round(spendAmount * REFERRAL_PERCENT) / 100;
  if (bonus <= 0) return;

  await tx.balance.update({ where: { userId: spender.referredById }, data: { amount: { increment: bonus } } });
  await tx.transaction.create({ data: { userId: spender.referredById, type: 'referral_bonus', amount: bonus, status: 'succeeded' } });
  await tx.referralEarning.create({ data: { referrerId: spender.referredById, referredId: spenderId, amount: bonus, spendAmount } });
}

/** Статистика партнёрки для пользователя. */
export async function getReferralStats(userId: string): Promise<{ code: string; invited: number; earned: number }> {
  const [code, invited, earnedAgg] = await Promise.all([
    getOrCreateReferralCode(userId),
    prisma.user.count({ where: { referredById: userId } }),
    prisma.referralEarning.aggregate({ _sum: { amount: true }, where: { referrerId: userId } }),
  ]);
  return { code, invited, earned: Number(earnedAgg._sum.amount ?? 0) };
}
