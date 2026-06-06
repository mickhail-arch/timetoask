//components/app/header.tsx

'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Check, ChevronRight } from 'lucide-react';
import { BalanceWidget } from '@/components/app/balance-widget';
import { UserMenu } from '@/components/app/user-menu';

const SEGMENT_LABELS: Record<string, string> = {
  tools: 'Инструменты',
  billing: 'Баланс и пополнение',
  profile: 'Профиль',
  admin: 'Админка',
  settings: 'Настройки',
  'seo-article': 'SEO-статья',
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const currentSegment = segments[segments.length - 1];
  const currentLabel =
    !currentSegment || currentSegment === 'tools'
      ? null
      : (SEGMENT_LABELS[currentSegment] ?? decodeURIComponent(currentSegment));

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <Link
        href="/tools"
        className="font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        Инструменты
      </Link>
      {currentLabel && (
        <>
          <ChevronRight className="size-3.5 text-[var(--color-text-secondary)] opacity-60" />
          <span className="font-medium text-[var(--color-text-primary)]">{currentLabel}</span>
        </>
      )}
    </nav>
  );
}

function IdCopyButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick() {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        className="cursor-pointer rounded-md border-0 bg-transparent p-0 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        ID: {id}
      </button>

      {copied && (
        <div
          role="status"
          className="absolute right-0 top-full mt-2 z-[var(--z-dropdown)] flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2.5 py-1.5 text-sm shadow-md"
        >
          <Check className="size-3.5 shrink-0 text-[var(--color-accent)]" />
          <span className="text-[var(--color-text-primary)]">ID скопирован</span>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="z-[var(--z-header)] flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6">
      <Breadcrumb />

      <div className="flex items-center gap-3">
        <BalanceWidget />

        <Link
          href="/billing"
          className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          Пополнить
        </Link>

        <a
          href="https://t.me/timetoask_support"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-page)] hover:text-[var(--color-text-primary)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="12" fill="#29B6F6"/>
            <path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.833.933l-1.97 9.281c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.327 13.7l-2.963-.924c-.643-.204-.657-.643.136-.953z" fill="white"/>
          </svg>
          <span className="hidden lg:inline">Поддержка</span>
        </a>

        {session?.user && (
          <>
            <UserMenu
              email={session.user.email ?? ''}
              role={session.user.role ?? 'user'}
            />
            <IdCopyButton id={session.user.id?.slice(0, 6) ?? ''} />
          </>
        )}
      </div>
    </header>
  );
}
