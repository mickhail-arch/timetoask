'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ChevronRight, FolderOpen, LogOut, MessageCircle } from 'lucide-react';
import { BalanceWidget } from '@/components/app/balance-widget';
import { UserMenu } from '@/components/app/user-menu';

const SEGMENT_LABELS: Record<string, string> = {
  tools: 'Инструменты',
  billing: 'Баланс и пополнение',
  profile: 'Профиль',
  admin: 'Админка',
  settings: 'Настройки',
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-sm text-text-secondary">
      <FolderOpen size={16} className="shrink-0" />
      {segments.map((seg, i) => {
        const label = SEGMENT_LABELS[seg] ?? decodeURIComponent(seg);
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={14} className="shrink-0" />
            <span className={isLast ? 'font-bold text-text-primary' : ''}>
              {label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-bg-surface px-4 z-header">
      {/* Left: Breadcrumb */}
      <Breadcrumb />

      {/* Right: actions group */}
      <div className="flex items-center gap-3">
        <BalanceWidget />

        <Link
          href="/billing"
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] bg-accent px-3 text-sm font-bold text-text-primary transition-colors hover:bg-accent-hover"
        >
          Пополнить
        </Link>

        <a
          href="https://t.me/timetoask_support"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <MessageCircle size={16} />
          <span className="hidden lg:inline">Поддержка</span>
        </a>

        {session?.user && (
          <>
            <UserMenu
              email={session.user.email ?? ''}
              role={session.user.role ?? 'user'}
            />

            <span className="text-xs text-text-secondary">
              ID {session.user.id?.slice(0, 6)}
            </span>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="rounded-[var(--radius-md)] p-1.5 text-text-secondary transition-colors hover:bg-[var(--color-border)] hover:text-text-primary"
              aria-label="Выйти"
            >
              <LogOut size={18} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
