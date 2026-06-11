// modules/auth/tests/auth.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  MAX_PASSWORD_ATTEMPTS,
  UnauthorizedError,
  TooManyRequestsError,
  ValidationError,
} = vi.hoisted(() => {
  const MAX_PASSWORD_ATTEMPTS = 10;

  class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, statusCode: number, message?: string) {
      super(message ?? code);
      this.code = code;
      this.statusCode = statusCode;
      this.name = 'AppError';
    }
  }
  class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
      super('UNAUTHORIZED', 401, message);
      this.name = 'UnauthorizedError';
    }
  }
  class ValidationError extends AppError {
    constructor(message = 'Validation error') {
      super('VALIDATION_ERROR', 400, message);
      this.name = 'ValidationError';
    }
  }
  class TooManyRequestsError extends AppError {
    constructor(message = 'Too many requests') {
      super('TOO_MANY_REQUESTS', 429, message);
      this.name = 'TooManyRequestsError';
    }
  }

  return { MAX_PASSWORD_ATTEMPTS, AppError, UnauthorizedError, ValidationError, TooManyRequestsError };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/adapters/email/smtp.adapter', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/referral/referral.service', () => ({
  attachReferrer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/core/config/env', () => ({
  env: {
    FREE_TOKENS_ON_REGISTER: 100,
  },
}));

vi.mock('@/core/constants', () => ({
  MAX_PASSWORD_ATTEMPTS,
  BCRYPT_ROUNDS: 4,
  VERIFICATION_CODE_TTL_MS: 15 * 60 * 1000,
  MAX_VERIFICATION_ATTEMPTS: 5,
  RESEND_CODE_COOLDOWN_SEC: 60,
}));

vi.mock('@/core/errors', () => ({
  UnauthorizedError,
  ValidationError,
  TooManyRequestsError,
  AppError: class extends Error {},
  InsufficientBalanceError: class extends Error {},
  FreeLimitExhaustedError: class extends Error {},
  DuplicateRequestError: class extends Error {},
  PayloadTooLargeError: class extends Error {},
  LlmUnavailableError: class extends Error {},
  InternalError: class extends Error {},
  ForbiddenError: class extends Error {},
  ErrorCode: {},
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import bcrypt from 'bcryptjs';
import { register, login } from '../auth.service';

const FREE_TOKENS = 100;

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-001',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: '$2a$04$mockedhash',
  emailVerified: null,
  role: 'user',
  supportLevel: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('auth.service', () => {
  const txMock = {
    user: { create: vi.fn() },
    balance: { create: vi.fn() },
    transaction: { create: vi.fn() },
    verificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (redis.expire as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (redis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    txMock.balance.create.mockResolvedValue({});
    txMock.transaction.create.mockResolvedValue({});
    txMock.verificationToken.deleteMany.mockResolvedValue({});
    txMock.verificationToken.create.mockResolvedValue({});
    (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2a$04$mockedhash');
  });

  describe('register — новый пользователь', () => {
    it('создаёт balance с amount=FREE_TOKENS_ON_REGISTER и transaction type=bonus status=succeeded', async () => {
      const user = makeUser();
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
      );
      txMock.user.create.mockResolvedValue(user);

      await register('test@example.com', 'password', 'Test User');

      expect(txMock.balance.create).toHaveBeenCalledWith({
        data: { userId: user.id, amount: FREE_TOKENS },
      });
      expect(txMock.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          type: 'bonus',
          amount: FREE_TOKENS,
          status: 'succeeded',
        },
      });
    });
  });

  describe('login — неверный пароль', () => {
    it('redis.expire вызывается только когда incr вернул 1 (два вызова подряд — expire один раз)', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      (redis.incr as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
      await expect(login('test@example.com', 'wrongpassword')).rejects.toThrow(UnauthorizedError);

      (redis.incr as ReturnType<typeof vi.fn>).mockResolvedValueOnce(2);
      await expect(login('test@example.com', 'wrongpassword')).rejects.toThrow(UnauthorizedError);

      expect(redis.expire).toHaveBeenCalledTimes(1);
    });
  });

  describe('login — превышение MAX_PASSWORD_ATTEMPTS', () => {
    it('бросает TooManyRequestsError до обращения к БД', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(String(MAX_PASSWORD_ATTEMPTS));

      await expect(login('test@example.com', 'anypassword')).rejects.toThrow(TooManyRequestsError);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });
});
