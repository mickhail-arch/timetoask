// modules/user/user.service.ts — User profile business logic
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import {
  BCRYPT_ROUNDS,
  DELETED_ACCOUNT_RETENTION_MS,
} from '@/core/constants';
import { UnauthorizedError, ValidationError } from '@/core/errors';

type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: Date | null;
  role: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function stripPassword(user: SafeUser & { passwordHash: string }): SafeUser {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

export async function getProfile(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new ValidationError('User not found');
  }

  return stripPassword(user);
}

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

export async function updateProfile(
  userId: string,
  data: { name?: string; email?: string },
): Promise<SafeUser> {
  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, id: { not: userId }, deletedAt: null },
    });
    if (existing) {
      throw new ValidationError('Email already in use');
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return stripPassword(user);
}

// ---------------------------------------------------------------------------
// deleteAccount (soft delete)
// ---------------------------------------------------------------------------

export async function deleteAccount(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// changePassword
// ---------------------------------------------------------------------------

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new ValidationError('User not found');
  }

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid current password');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

// ---------------------------------------------------------------------------
// purgeDeletedAccounts — physical removal of soft-deleted users (for cron)
// ---------------------------------------------------------------------------

export async function purgeDeletedAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - DELETED_ACCOUNT_RETENTION_MS);

  const { count } = await prisma.user.deleteMany({
    where: {
      deletedAt: { not: null, lt: cutoff },
    },
  });

  if (count > 0) {
    console.info(`[user] purgeDeletedAccounts: removed ${count} account(s)`);
  }

  return count;
}
