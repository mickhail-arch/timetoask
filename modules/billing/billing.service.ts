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
  verifyWebhookSignature,
} from '@/adapters/payments/yokassa.adapter';

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

  await prisma.transaction.create({
    data: {
      userId,
      type: 'deposit',
      amount,
      providerPaymentId: payment.paymentId,
      status: 'pending',
    },
  });

  return {
    paymentId: payment.paymentId,
    confirmationUrl: payment.confirmationUrl,
  };
}

// ---------------------------------------------------------------------------
// handleWebhook
// ---------------------------------------------------------------------------

export async function handleWebhook(
  body: string,
  signature: string,
): Promise<void> {
  if (!verifyWebhookSignature(body, signature)) {
    throw new ValidationError('Invalid webhook signature');
  }

  const payload = JSON.parse(body) as {
    object: { id: string; status: string };
  };

  const providerPaymentId = payload.object.id;
  const paymentStatus = payload.object.status;

  const existing = await prisma.transaction.findUnique({
    where: { providerPaymentId },
  });

  if (!existing) {
    throw new ValidationError('Transaction not found for this payment');
  }

  if (existing.status === 'succeeded') return;

  if (paymentStatus !== 'succeeded') return;

  await prisma.$transaction(
    async (tx) => {
      await tx.transaction.update({
        where: { id: existing.id },
        data: { status: 'succeeded' },
      });

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
  const existingLog = await tx.usageLog.findUnique({
    where: { idempotencyKey },
  });
  if (existingLog) return;

  const balance = await tx.balance.findUniqueOrThrow({
    where: { userId },
  });

  const available = balance.amount.sub(balance.reserved);
  if (available.lt(cost)) {
    throw new InsufficientBalanceError();
  }

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
): Promise<void> {
  await tx.balance.update({
    where: { userId },
    data: {
      amount: { decrement: cost },
      reserved: { decrement: cost },
    },
  });
}

// ---------------------------------------------------------------------------
// rollbackTokens
// ---------------------------------------------------------------------------

export async function rollbackTokens(
  userId: string,
  cost: number,
  tx: TxClient,
): Promise<void> {
  await tx.balance.update({
    where: { userId },
    data: { reserved: { decrement: cost } },
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
    const stale = await tx.balance.findMany({
      where: {
        reserved: { gt: 0 },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, userId: true },
    });

    if (stale.length === 0) return;

    for (const record of stale) {
      await tx.balance.update({
        where: { id: record.id },
        data: { reserved: 0 },
      });
    }

    console.warn(
      `[billing] cleanupStaleReserves: reset ${stale.length} stale reserve(s)`,
      stale.map((r) => r.userId),
    );
  });
}
