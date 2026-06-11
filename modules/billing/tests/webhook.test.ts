// modules/billing/tests/webhook.test.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/adapters/payments/yokassa.adapter', () => ({
  getPayment: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { getPayment } from '@/adapters/payments/yokassa.adapter';
import { prisma } from '@/lib/prisma';
import { handleWebhook } from '../billing.service';
import { ValidationError } from '@/core/errors';

const PAYMENT_ID = 'pay_test_001';
const TX_ID = 'tx_test_001';
const USER_ID = 'user_test_001';
const AMOUNT = 500;

const txMock = {
  transaction: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  balance: {
    update: vi.fn(),
  },
};

describe('handleWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    txMock.transaction.update.mockResolvedValue({});
    txMock.balance.update.mockResolvedValue({});

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock),
    );
  });

  it('status=succeeded + pending-транзакция → transaction.update и balance.increment вызваны', async () => {
    const existing = {
      id: TX_ID,
      userId: USER_ID,
      status: 'pending',
      amount: AMOUNT,
      providerPaymentId: PAYMENT_ID,
    };

    (getPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentId: PAYMENT_ID,
      status: 'succeeded',
      amountValue: `${AMOUNT}.00`,
    });
    (prisma.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    txMock.transaction.findUnique.mockResolvedValue(existing);

    await handleWebhook(JSON.stringify({ object: { id: PAYMENT_ID } }));

    expect(txMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TX_ID },
        data: { status: 'succeeded' },
      }),
    );
    expect(txMock.balance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        data: { amount: { increment: AMOUNT } },
      }),
    );
  });

  it('status=canceled → никаких записей в БД', async () => {
    (getPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentId: PAYMENT_ID,
      status: 'canceled',
      amountValue: `${AMOUNT}.00`,
    });

    await handleWebhook(JSON.stringify({ object: { id: PAYMENT_ID } }));

    expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('транзакция уже succeeded → повторного increment нет', async () => {
    (getPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentId: PAYMENT_ID,
      status: 'succeeded',
      amountValue: `${AMOUNT}.00`,
    });
    (prisma.transaction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TX_ID,
      userId: USER_ID,
      status: 'succeeded',
      amount: AMOUNT,
      providerPaymentId: PAYMENT_ID,
    });

    await handleWebhook(JSON.stringify({ object: { id: PAYMENT_ID } }));

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(txMock.transaction.update).not.toHaveBeenCalled();
    expect(txMock.balance.update).not.toHaveBeenCalled();
  });

  it('тело без object.id → бросает ValidationError', async () => {
    await expect(
      handleWebhook(JSON.stringify({ type: 'notification' })),
    ).rejects.toThrow(ValidationError);

    expect(getPayment).not.toHaveBeenCalled();
    expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
  });
});
