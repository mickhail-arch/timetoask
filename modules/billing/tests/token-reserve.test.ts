// modules/billing/tests/token-reserve.test.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted stubs — available inside vi.mock() factories
// ---------------------------------------------------------------------------

const { MockDecimal, InsufficientBalanceError } = vi.hoisted(() => {
  class MockDecimal {
    private val: number;
    constructor(v: number | string | MockDecimal) {
      this.val = v instanceof MockDecimal ? (v as MockDecimal).val : Number(v);
    }
    sub(other: MockDecimal | number | string): MockDecimal {
      const n = other instanceof MockDecimal ? (other as MockDecimal).val : Number(other);
      return new MockDecimal(this.val - n);
    }
    lt(other: MockDecimal | number | string): boolean {
      const n = other instanceof MockDecimal ? (other as MockDecimal).val : Number(other);
      return this.val < n;
    }
    toNumber(): number { return this.val; }
    toString(): string { return String(this.val); }
  }

  class AppError extends Error {
    code: string; statusCode: number;
    constructor(code: string, statusCode: number, message?: string) {
      super(message ?? code); this.code = code; this.statusCode = statusCode;
    }
  }
  class InsufficientBalanceError extends AppError {
    constructor(message = 'Insufficient balance') {
      super('INSUFFICIENT_BALANCE', 402, message);
      this.name = 'InsufficientBalanceError';
    }
  }

  return { MockDecimal, InsufficientBalanceError };
});

// ---------------------------------------------------------------------------
// Module mocks — must be before any imports from @/
// ---------------------------------------------------------------------------

vi.mock('@/generated/prisma', () => ({
  Prisma: { Decimal: MockDecimal },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('@/core/constants', () => ({
  FREE_USES_START_OF_TIME: new Date(0),
  STALE_RESERVE_CUTOFF_MS: 3_600_000,
}));

vi.mock('@/core/errors', () => ({
  InsufficientBalanceError,
  InternalError: class extends Error {},
  ValidationError: class extends Error {},
  AppError: class extends Error {},
}));

vi.mock('@/adapters/payments/yokassa.adapter', () => ({
  createPayment: vi.fn(),
  getPayment: vi.fn(),
}));

vi.mock('@/modules/referral/referral.service', () => ({
  creditReferralOnSpend: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (all come from mocks above)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma';
import { creditReferralOnSpend } from '@/modules/referral/referral.service';
import {
  reserveTokens,
  finalizeTokens,
  rollbackTokens,
  cleanupStaleReserves,
} from '../billing.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dec(v: number | string) {
  return new MockDecimal(v);
}

type TxMock = ReturnType<typeof makeTx>;

function makeTx(overrides: {
  tokenReserveFindFirst?: unknown;
  balanceFindUniqueOrThrow?: unknown;
  balanceFindUnique?: unknown;
} = {}) {
  return {
    tokenReserve: {
      findFirst: vi.fn().mockResolvedValue(overrides.tokenReserveFindFirst ?? null),
      create: vi.fn().mockResolvedValue({ id: 'res_1' }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    balance: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(
        overrides.balanceFindUniqueOrThrow ?? {
          userId: 'user_001',
          amount: dec(500),
          reserved: dec(0),
        },
      ),
      findUnique: vi.fn().mockResolvedValue(
        overrides.balanceFindUnique ?? { reserved: dec(0) },
      ),
      update: vi.fn().mockResolvedValue({}),
    },
    jobStep: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

const USER_ID = 'user_001';
const IDEM_KEY = 'job:abc:reserve';
const COST = 100;

beforeEach(() => {
  vi.clearAllMocks();
  (creditReferralOnSpend as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    (fn: (tx: TxMock) => Promise<void>) => fn(makeTx()),
  );
});

// ---------------------------------------------------------------------------
// reserveTokens
// ---------------------------------------------------------------------------

describe('reserveTokens', () => {
  it('создаёт tokenReserve и увеличивает reserved', async () => {
    const tx = makeTx();

    await reserveTokens(USER_ID, COST, IDEM_KEY, tx as never);

    expect(tx.tokenReserve.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          amount: COST,
          idempotencyKey: IDEM_KEY,
          status: 'active',
        }),
      }),
    );
    expect(tx.balance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        data: { reserved: { increment: COST } },
      }),
    );
  });

  it('повторный вызов с тем же ключом при активном резерве не создаёт строку и не трогает баланс', async () => {
    const existingReserve = {
      id: 'res_existing',
      userId: USER_ID,
      amount: dec(COST),
      idempotencyKey: IDEM_KEY,
      status: 'active',
    };
    const tx = makeTx({ tokenReserveFindFirst: existingReserve });

    await reserveTokens(USER_ID, COST, IDEM_KEY, tx as never);

    expect(tx.tokenReserve.create).not.toHaveBeenCalled();
    expect(tx.balance.update).not.toHaveBeenCalled();
  });

  it('бросает InsufficientBalanceError когда available < cost', async () => {
    const tx = makeTx({
      balanceFindUniqueOrThrow: {
        userId: USER_ID,
        amount: dec(50),
        reserved: dec(0),
      },
    });

    await expect(
      reserveTokens(USER_ID, COST, IDEM_KEY, tx as never),
    ).rejects.toThrow(InsufficientBalanceError);

    expect(tx.tokenReserve.create).not.toHaveBeenCalled();
    expect(tx.balance.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// finalizeTokens
// ---------------------------------------------------------------------------

describe('finalizeTokens', () => {
  it('помечает резерв finalized и уменьшает amount и reserved ровно на сумму резерва', async () => {
    const reserveAmount = dec(COST);
    const existingReserve = {
      id: 'res_1',
      userId: USER_ID,
      amount: reserveAmount,
      idempotencyKey: IDEM_KEY,
      status: 'active',
    };
    const tx = makeTx({
      tokenReserveFindFirst: existingReserve,
      balanceFindUniqueOrThrow: {
        userId: USER_ID,
        amount: dec(500),
        reserved: dec(COST),
      },
    });

    await finalizeTokens(USER_ID, COST, tx as never, IDEM_KEY);

    expect(tx.tokenReserve.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res_1' },
        data: { status: 'finalized' },
      }),
    );

    const balCall = (tx.balance.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(balCall.where).toEqual({ userId: USER_ID });
    expect(balCall.data.amount).toEqual({ decrement: reserveAmount });
    // reserved: было COST, вычли COST → 0
    expect((balCall.data.reserved as InstanceType<typeof MockDecimal>).toNumber()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rollbackTokens
// ---------------------------------------------------------------------------

describe('rollbackTokens', () => {
  it('помечает резерв rolled_back и уменьшает только reserved, не трогает amount', async () => {
    const reserveAmount = dec(COST);
    const existingReserve = {
      id: 'res_1',
      userId: USER_ID,
      amount: reserveAmount,
      idempotencyKey: IDEM_KEY,
      status: 'active',
    };
    const tx = makeTx({
      tokenReserveFindFirst: existingReserve,
      balanceFindUniqueOrThrow: {
        userId: USER_ID,
        amount: dec(500),
        reserved: dec(COST),
      },
    });

    await rollbackTokens(USER_ID, COST, tx as never, IDEM_KEY);

    expect(tx.tokenReserve.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res_1' },
        data: { status: 'rolled_back' },
      }),
    );

    const balCall = (tx.balance.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(balCall.where).toEqual({ userId: USER_ID });
    // reserved: было COST, вычли COST → 0
    expect((balCall.data.reserved as InstanceType<typeof MockDecimal>).toNumber()).toBe(0);
    // amount не передаётся в rollback
    expect(balCall.data.amount).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// cleanupStaleReserves
// ---------------------------------------------------------------------------

describe('cleanupStaleReserves', () => {
  const USER_NO_JOB = 'user_no_job';
  const USER_WITH_JOB = 'user_with_job';

  const staleReserves = [
    {
      id: 'res_stale_1',
      userId: USER_NO_JOB,
      amount: dec(80),
      idempotencyKey: 'job:stale:1',
      status: 'active',
      createdAt: new Date(0),
    },
    {
      id: 'res_stale_2',
      userId: USER_WITH_JOB,
      amount: dec(120),
      idempotencyKey: 'job:stale:2',
      status: 'active',
      createdAt: new Date(0),
    },
  ];

  it('откатывает просроченный active-резерв пользователя без активных задач и не трогает резерв пользователя с задачей в статусе processing', async () => {
    const txTokenReserveUpdate = vi.fn().mockResolvedValue({});
    const txBalanceUpdate = vi.fn().mockResolvedValue({});

    const mockTx = {
      tokenReserve: {
        findMany: vi.fn().mockResolvedValue(staleReserves),
        update: txTokenReserveUpdate,
      },
      balance: {
        findUnique: vi.fn().mockImplementation(
          ({ where }: { where: { userId: string } }) =>
            Promise.resolve({
              reserved: where.userId === USER_NO_JOB ? dec(80) : dec(120),
            }),
        ),
        update: txBalanceUpdate,
      },
      jobStep: {
        findMany: vi.fn().mockResolvedValue([{ userId: USER_WITH_JOB }]),
      },
    };

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx),
    );

    await cleanupStaleReserves();

    // Пользователь без задачи: резерв должен быть откачен
    expect(txTokenReserveUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res_stale_1' },
        data: { status: 'rolled_back' },
      }),
    );
    expect(txBalanceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_NO_JOB } }),
    );

    // Пользователь с активной задачей (processing): резерв НЕ трогается
    expect(txTokenReserveUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'res_stale_2' } }),
    );
    expect(txBalanceUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_WITH_JOB } }),
    );
  });
});
