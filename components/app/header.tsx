'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CheckCircle } from 'lucide-react';
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
  const currentSegment = segments[segments.length - 1];
  const currentLabel =
    !currentSegment || currentSegment === 'tools'
      ? null
      : (SEGMENT_LABELS[currentSegment] ?? decodeURIComponent(currentSegment));

  return (
    <nav className="flex items-center gap-2">
      <Link
        href="/tools"
        className="transition-colors hover:opacity-80"
        style={{ color: '#171717', fontWeight: 400, fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
      >
        Инструменты
      </Link>
      {currentLabel && (
        <>
          <span style={{ color: '#171717', fontWeight: 400, fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            {'>'}
          </span>
          <span style={{ color: '#171717', fontWeight: 400, fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            {currentLabel}
          </span>
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
        className="cursor-pointer border-0 bg-transparent p-0"
        style={{ color: '#171717', fontWeight: 400, fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
      >
        ID: {id}
      </button>

      {copied && (
        <div
          className="absolute right-0 mt-2 flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-border bg-bg-surface px-2.5 py-1.5 shadow-[var(--shadow-md)] z-[var(--z-dropdown)]"
          style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}
        >
          <CheckCircle size={14} className="shrink-0 text-accent" style={{ color: '#A3E635' }} />
          <span style={{ color: '#171717' }}>ID скопирован</span>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-bg-surface pr-4 z-header">
      {/* Left: Breadcrumb */}
      <div className="pl-6">
        <Breadcrumb />
      </div>

      {/* Right: actions group */}
      <div className="flex items-center gap-4">
        <BalanceWidget />

        <Link
          href="/billing"
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] bg-[#a6e800] px-[17px] transition-colors hover:bg-[#E8E8E8]"
          style={{ color: '#171717', fontWeight: 400, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
        >
          Пополнить
        </Link>

        <a
          href="https://t.me/timetoask_support"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1 transition-colors hover:bg-[#E8E8E8]"
          style={{ color: '#171717', fontWeight: 400, fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
