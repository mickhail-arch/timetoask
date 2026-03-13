// modules/auth/auth.service.ts — Authentication business logic
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { env } from '@/core/config/env';
import { BCRYPT_ROUNDS, MAX_PASSWORD_ATTEMPTS } from '@/core/constants';
import {
  UnauthorizedError,
  ValidationError,
  TooManyRequestsError,
} from '@/core/errors';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '@/adapters/email/smtp.adapter';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 h
const LOGIN_ATTEMPTS_TTL_SEC = 15 * 60; // 15 min

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: Date | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

function stripPassword(user: SafeUser & { passwordHash: string }): SafeUser {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<SafeUser> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ValidationError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const token = generateToken();

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, passwordHash, name },
    });

    await tx.balance.create({
      data: {
        userId: created.id,
        amount: env.FREE_TOKENS_ON_REGISTER,
      },
    });

    await tx.verificationToken.create({
      data: {
        token,
        userId: created.id,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    });

    return created;
  });

  sendVerificationEmail(email, token).catch(console.error);

  return stripPassword(user);
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
): Promise<SafeUser> {
  const attemptsKey = `auth:attempts:${email}`;

  const attempts = await redis.get(attemptsKey);
  if (attempts !== null && Number(attempts) >= MAX_PASSWORD_ATTEMPTS) {
    throw new TooManyRequestsError('Account temporarily locked');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await redis.incr(attemptsKey);
    await redis.expire(attemptsKey, LOGIN_ATTEMPTS_TTL_SEC);
    throw new UnauthorizedError('Invalid credentials');
  }

  await redis.del(attemptsKey);
  return stripPassword(user);
}

// ---------------------------------------------------------------------------
// requestPasswordReset
// ---------------------------------------------------------------------------

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  await prisma.passwordResetToken.deleteMany({ where: { email } });

  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      token,
      email,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    },
  });

  sendPasswordResetEmail(email, token).catch(console.error);
}

// ---------------------------------------------------------------------------
// confirmPasswordReset
// ---------------------------------------------------------------------------

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!record || record.expiresAt < new Date()) {
    throw new ValidationError('Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.email },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
  ]);
}

// ---------------------------------------------------------------------------
// verifyEmail
// ---------------------------------------------------------------------------

export async function verifyEmail(token: string): Promise<void> {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.expiresAt < new Date()) {
    throw new ValidationError('Invalid or expired verification token');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);
}
