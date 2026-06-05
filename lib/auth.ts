import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { login } from '@/modules/auth/auth.service';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

const IMPERSONATION_TTL_MS = 30 * 60 * 1000; // 30 минут

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const user = await login(credentials.email, credentials.password);
          return { id: user.id, email: user.email, name: user.name, role: user.role, supportLevel: user.supportLevel };
        } catch {
          return null;
        }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // первичный вход
      if (user) {
        token.role = (user as { role?: string }).role;
        token.supportLevel = (user as { supportLevel?: string | null }).supportLevel ?? null;
        return token;
      }

      // авто-истечение режима поддержки
      if (token.impersonatedBy && token.impExp && Date.now() > token.impExp) {
        const admin = await prisma.user.findUnique({ where: { id: token.impersonatedBy }, select: { role: true, supportLevel: true } });
        token.sub = token.impersonatedBy;
        token.role = admin?.role ?? 'user';
        token.supportLevel = admin?.supportLevel ?? null;
        token.impersonatedBy = null;
        token.impersonationLevel = null;
        token.impExp = null;
        return token;
      }

      if (trigger === 'update' && session) {
        const action = (session as { action?: string }).action;

        // старт: применяем серверный грант из Redis (привязан к id админа)
        if (action === 'impersonate' && !token.impersonatedBy && token.sub) {
          const adminSub = token.sub;
          const raw = await redis.get(`impersonation-grant:${adminSub}`);
          if (raw) {
            const grant = JSON.parse(raw) as { targetUserId: string; level: 'view' | 'full'; exp: number };
            if (grant.exp > Date.now()) {
              const target = await prisma.user.findUnique({ where: { id: grant.targetUserId }, select: { role: true, supportLevel: true } });
              if (target && target.role !== 'admin') {
                token.impersonatedBy = adminSub;
                token.sub = grant.targetUserId;
                token.role = target.role;
                token.supportLevel = target.supportLevel ?? null;
                token.impersonationLevel = grant.level;
                token.impExp = Date.now() + IMPERSONATION_TTL_MS;
              }
            }
          }
          await redis.del(`impersonation-grant:${adminSub}`);
        }

        // стоп: возвращаемся в админа
        if (action === 'stop-impersonate' && token.impersonatedBy) {
          const admin = await prisma.user.findUnique({ where: { id: token.impersonatedBy }, select: { role: true, supportLevel: true } });
          token.sub = token.impersonatedBy;
          token.role = admin?.role ?? 'user';
          token.supportLevel = admin?.supportLevel ?? null;
          token.impersonatedBy = null;
          token.impersonationLevel = null;
          token.impExp = null;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role as string;
      session.user.supportLevel = (token.supportLevel as string | null) ?? null;
      session.impersonatedBy = (token.impersonatedBy as string | null) ?? null;
      session.impersonationLevel = (token.impersonationLevel as 'view' | 'full' | null) ?? null;
      return session;
    },
  },
};
