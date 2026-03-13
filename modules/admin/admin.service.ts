// modules/admin/admin.service.ts — Admin panel business logic
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/core/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DashboardStats = {
  totalUsers: number;
  totalTools: number;
  totalRevenue: Prisma.Decimal;
  totalUsageLogs: number;
  newUsersToday: number;
  activeToolsCount: number;
  pendingJobs: number;
  recentTransactions: number;
};

type Pagination = { page: number; limit: number };
type UserFilters = { email?: string; role?: string };
type LogFilters = { userId?: string; toolId?: string };

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

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  role: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// getDashboard
// ---------------------------------------------------------------------------

export async function getDashboard(): Promise<DashboardStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalTools,
    revenueAgg,
    totalUsageLogs,
    newUsersToday,
    activeToolsCount,
    pendingJobs,
    recentTransactions,
  ] = await prisma.$transaction([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.tool.count(),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: 'succeeded' },
    }),
    prisma.usageLog.count(),
    prisma.user.count({
      where: { createdAt: { gte: startOfDay }, deletedAt: null },
    }),
    prisma.tool.count({ where: { status: 'active' } }),
    prisma.jobStep.count({
      where: { status: { in: ['pending', 'processing'] } },
    }),
    prisma.transaction.count({
      where: { createdAt: { gte: last24h } },
    }),
  ]);

  return {
    totalUsers,
    totalTools,
    totalRevenue: revenueAgg._sum.amount ?? new Prisma.Decimal(0),
    totalUsageLogs,
    newUsersToday,
    activeToolsCount,
    pendingJobs,
    recentTransactions,
  };
}

// ---------------------------------------------------------------------------
// getUsers
// ---------------------------------------------------------------------------

export async function getUsers(
  filters: UserFilters,
  pagination: Pagination,
): Promise<{ users: SafeUser[]; total: number }> {
  const where: Prisma.UserWhereInput = {};

  if (filters.email) {
    where.email = { contains: filters.email, mode: 'insensitive' };
  }
  if (filters.role) {
    where.role = filters.role;
  }

  const { page, limit } = pagination;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: safeUserSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

// ---------------------------------------------------------------------------
// getUserById
// ---------------------------------------------------------------------------

export async function getUserById(id: string): Promise<
  SafeUser & { balance: { amount: Prisma.Decimal; reserved: Prisma.Decimal } | null }
> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...safeUserSelect,
      balance: { select: { amount: true, reserved: true } },
    },
  });

  if (!user) {
    throw new ValidationError('User not found');
  }

  return user;
}

// ---------------------------------------------------------------------------
// updateUser
// ---------------------------------------------------------------------------

export async function updateUser(
  id: string,
  data: { name?: string; email?: string; role?: string },
): Promise<SafeUser> {
  return prisma.user.update({
    where: { id },
    data,
    select: safeUserSelect,
  });
}

// ---------------------------------------------------------------------------
// getTools
// ---------------------------------------------------------------------------

export async function getTools() {
  return prisma.tool.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// getToolById
// ---------------------------------------------------------------------------

export async function getToolById(id: string) {
  const tool = await prisma.tool.findUnique({ where: { id } });

  if (!tool) {
    throw new ValidationError('Tool not found');
  }

  return tool;
}

// ---------------------------------------------------------------------------
// updateTool
// ---------------------------------------------------------------------------

export async function updateTool(
  id: string,
  data: {
    name?: string;
    description?: string;
    model?: string;
    promptText?: string;
    status?: string;
    executionMode?: string;
    tokenCost?: number;
    freeUsesLimit?: number;
    config?: Prisma.InputJsonValue;
  },
) {
  return prisma.tool.update({
    where: { id },
    data,
  });
}

// ---------------------------------------------------------------------------
// getLogs
// ---------------------------------------------------------------------------

export async function getLogs(
  filters: LogFilters,
  pagination: Pagination,
) {
  const where: Prisma.UsageLogWhereInput = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }
  if (filters.toolId) {
    where.toolId = filters.toolId;
  }

  const { page, limit } = pagination;

  const [logs, total] = await prisma.$transaction([
    prisma.usageLog.findMany({
      where,
      include: {
        user: { select: { email: true } },
        tool: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.usageLog.count({ where }),
  ]);

  return { logs, total };
}
