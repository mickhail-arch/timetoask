'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback } from 'react';
import { Share2, Wallet, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useTools } from '@/hooks/useTools';
import { NavItem } from '@/components/app/nav-item';
import { NAV_ITEMS } from '@/config/nav';

const ICON_MAP: Record<string, React.ReactNode> = {
  Wallet: <Wallet />,
};

function ToolIcon() {
  return <Wrench />;
}

function ShareButton() {
  const handleShare = useCallback(async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/register`
        : '/register';
    const text = 'Попробуй Таймтуаск — маркетинговые AI-инструменты';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Таймтуаск', text, url });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Ссылка скопирована');
        } catch {
          toast.error('Не удалось скопировать ссылку');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Ссылка скопирована');
      } catch {
        toast.error('Не удалось скопировать ссылку');
      }
    }
  }, []);

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-[#E8E8E8] hover:text-text-primary"
    >
      <Share2 size={18} />
      Поделиться
    </button>
  );
}

export function Sidebar() {
  const { tools, isLoading } = useTools();

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-bg-sidebar z-sidebar">
      {/* Logo + collapse */}
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/tools">
          <Image
            src="/logo.svg"
            alt="Таймтуаск"
            width={318}
            height={54}
            className="h-[26px] w-auto"
            priority
          />
        </Link>
        {/* <button
          type="button"
          className="rounded-[var(--radius-md)] p-1 text-text-secondary transition-colors hover:bg-[var(--color-border)] hover:text-text-primary"
          aria-label="Свернуть меню"
        >
          <PanelLeftClose size={18} />
        </button> */}
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-border)] animate-pulse"
            />
          ))
        ) : (
          tools.map((tool) => (
            <NavItem
              key={tool.id}
              icon={<ToolIcon />}
              label={tool.name}
              href={`/tools/${tool.slug}`}
            />
          ))
        )}

        {/* Static nav items */}
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            icon={ICON_MAP[item.icon] ?? <Wallet />}
            label={item.label}
            href={item.href}
          />
        ))}
      </nav>

      {/* Bottom: Share */}
      <div className="px-3 py-4">
        <ShareButton />
      </div>
    </aside>
  );
}
