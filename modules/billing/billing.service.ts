// modules/billing/billing.service.ts — Billing business logic (Reserve → Execute → Finalize)
import { Prisma, type PrismaClient } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import {
  FREE_USES_START_OF_TIME,
  STALE_RESERVE_CUTOFF_MS,
} from '@/core/constants';
import {
  InsufficientBalanceError,
  InternalError,
  ValidationError,
} from '@/core/errors';
import {
  createPayment,
  getPayment,
} from '@/adapters/payments/yokassa.adapter';
import { creditReferralOnSpend } from '@/modules/referral/referral.service';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type Pagination = { page: number; limit: number };

type Balance = {
  id: string;
  userId: string;
  amount: Prisma.Decimal;
  reserved: Prisma.Decimal;
  updatedAt: Date;
};

type Transaction = {
  id: string;
  userId: string;
  type: string;
  amount: Prisma.Decimal;
  providerPaymentId: string | null;
  status: string;
  createdAt: Date;
};

type CheckoutResult = {
  paymentId: string;
  confirmationUrl: string;
};

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------

export async function getBalance(userId: string): Promise<Balance> {
  return prisma.$transaction(async (tx) => {
    const balance = await tx.balance.findUnique({ where: { userId } });
    if (!balance) {
      throw new ValidationError('Balance not found');
    }
    return balance;
  });
}

// ---------------------------------------------------------------------------
// getHistory
// ---------------------------------------------------------------------------

export async function getHistory(
  userId: string,
  pagination: Pagination,
): Promise<Transaction[]> {
  const { page, limit } = pagination;
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// createCheckout
// ---------------------------------------------------------------------------

export async function createCheckout(
  userId: string,
  amount: number,
): Promise<CheckoutResult> {
  const windowMin = Math.floor(Date.now() / 60_000);
  const idempotencyKey = `checkout:${userId}:${amount}:${windowMin}`;

  const payment = await createPayment(amount, idempotencyKey);

  try {
    await prisma.transaction.create({
      data: {
        userId,
        type: 'deposit',
        amount,
        providerPaymentId: payment.paymentId,
        status: 'pending',
      },
    });
  } catch (err) {
    // Повтор в том же минутном окне — транзакция уже создана, не падаем
    const isDuplicate =
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002';
    if (!isDuplicate) throw err;
  }

  return {
    paymentId: payment.paymentId,
    confirmationUrl: payment.confirmationUrl,
  };
}

// ---------------------------------------------------------------------------
// handleWebhook
// ---------------------------------------------------------------------------

export async function handleWebhook(body: string): Promise<void> {
  const payload = JSON.parse(body) as { object?: { id?: string } };
  const claimedId = payload.object?.id;
  if (!claimedId) throw new ValidationError('Malformed webhook payload');

  // Источник истины — API ЮKassa, а не тело вебхука
  const payment = await getPayment(claimedId);
  if (payment.status !== 'succeeded') return;

  const existing = await prisma.transaction.findUnique({
    where: { providerPaymentId: payment.paymentId },
  });
  if (!existing) throw new ValidationError('Transaction not found for this payment');
  if (existing.status === 'succeeded') return;

  await prisma.$transaction(
    async (tx) => {
      const fresh = await tx.transaction.findUnique({ where: { id: existing.id } });
      if (!fresh || fresh.status === 'succeeded') return;
      await tx.transaction.update({ where: { id: existing.id }, data: { status: 'succeeded' } });
      await tx.balance.update({
        where: { userId: existing.userId },
        data: { amount: { increment: existing.amount } },
      });
    },
    { isolationLevel: 'Serializable' },
  );
}

// ---------------------------------------------------------------------------
// reserveTokens
// ---------------------------------------------------------------------------

export async function reserveTokens(
  userId: string,
  cost: number,
  idempotencyKey: string,
  tx: TxClient,
): Promise<void> {
  if (cost <= 0) return;

  const existing = await tx.tokenReserve.findFirst({
    where: { idempotencyKey, status: 'active' },
  });
  if (existing) return;

  const balance = await tx.balance.findUniqueOrThrow({ where: { userId } });
  const available = balance.amount.sub(balance.reserved);
  if (available.lt(cost)) {
    throw new InsufficientBalanceError();
  }

  await tx.tokenReserve.create({
    data: { userId, amount: cost, idempotencyKey, status: 'active' },
  });
  await tx.balance.update({
    where: { userId },
    data: { reserved: { increment: cost } },
  });
}

// ---------------------------------------------------------------------------
// finalizeTokens
// ---------------------------------------------------------------------------

export async function finalizeTokens(
  userId: string,
  cost: number,
  tx: TxClient,
  idempotencyKey?: string,
): Promise<void> {
  const reserve = idempotencyKey
    ? await tx.tokenReserve.findFirst({
        where: { idempotencyKey, status: 'active' },
        orderBy: { createdAt: 'desc' },
      })
    : null;
  const amount = reserve ? reserve.amount : new Prisma.Decimal(cost);

  if (reserve) {
    await tx.tokenReserve.update({
      where: { id: reserve.id },
      data: { status: 'finalized' },
    });
  }

  const balance = await tx.balance.findUniqueOrThrow({
    where: { userId },
    select: { reserved: true },
  });
  const nextReserved = balance.reserved.lt(amount)
    ? new Prisma.Decimal(0)
    : balance.reserved.sub(amount);

  await tx.balance.update({
    where: { userId },
    data: { amount: { decrement: amount }, reserved: nextReserved },
  });
  await creditReferralOnSpend(tx, userId, Number(amount));
}

// ---------------------------------------------------------------------------
// rollbackTokens
// ---------------------------------------------------------------------------

export async function rollbackTokens(
  userId: string,
  cost: number,
  tx: TxClient,
  idempotencyKey?: string,
): Promise<void> {
  const reserve = idempotencyKey
    ? await tx.tokenReserve.findFirst({
        where: { idempotencyKey, status: 'active' },
        orderBy: { createdAt: 'desc' },
      })
    : null;
  const amount = reserve ? reserve.amount : new Prisma.Decimal(cost);

  if (reserve) {
    await tx.tokenReserve.update({
      where: { id: reserve.id },
      data: { status: 'rolled_back' },
    });
  }

  const balance = await tx.balance.findUniqueOrThrow({
    where: { userId },
    select: { reserved: true },
  });
  const nextReserved = balance.reserved.lt(amount)
    ? new Prisma.Decimal(0)
    : balance.reserved.sub(amount);

  await tx.balance.update({
    where: { userId },
    data: { reserved: nextReserved },
  });
}

// ---------------------------------------------------------------------------
// checkFreeUses
// ---------------------------------------------------------------------------

export async function checkFreeUses(
  userId: string,
  toolId: string,
): Promise<{ allowed: boolean; usesLeft: number }> {
  const tool = await prisma.tool.findUniqueOrThrow({
    where: { id: toolId },
    select: { freeUsesLimit: true },
  });

  const used = await prisma.usageLog.count({
    where: {
      userId,
      toolId,
      createdAt: { gte: FREE_USES_START_OF_TIME },
    },
  });

  const usesLeft = Math.max(0, tool.freeUsesLimit - used);
  return { allowed: usesLeft > 0, usesLeft };
}

// ---------------------------------------------------------------------------
// cleanupStaleReserves
// ---------------------------------------------------------------------------

export async function cleanupStaleReserves(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RESERVE_CUTOFF_MS);

  await prisma.$transaction(async (tx) => {
    const stale = await tx.tokenReserve.findMany({
      where: { status: 'active', createdAt: { lt: cutoff } },
    });
    if (stale.length === 0) return;

    const activeJobs = await tx.jobStep.findMany({
      where: {
        userId: { in: [...new Set(stale.map((r) => r.userId))] },
        status: { in: ['pending', 'processing', 'awaiting_confirmation'] },
      },
      select: { userId: true },
    });
    const activeUserIds = new Set(activeJobs.map((j) => j.userId));
    const orphaned = stale.filter((r) => !activeUserIds.has(r.userId));
    if (orphaned.length === 0) return;

    for (const r of orphaned) {
      await tx.tokenReserve.update({
        where: { id: r.id },
        data: { status: 'rolled_back' },
      });
      const bal = await tx.balance.findUnique({
        where: { userId: r.userId },
        select: { reserved: true },
      });
      if (!bal) continue;
      const next = bal.reserved.lt(r.amount)
        ? new Prisma.Decimal(0)
        : bal.reserved.sub(r.amount);
      await tx.balance.update({
        where: { userId: r.userId },
        data: { reserved: next },
      });
    }

    console.warn(
      `[billing] cleanupStaleReserves: rolled back ${orphaned.length} stale reserve(s)`,
      orphaned.map((r) => `${r.userId}:${r.idempotencyKey}`),
    );
  }, { isolationLevel: 'Serializable' });
}
