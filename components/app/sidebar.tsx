'use client';

import { PanelLeftClose, Share2, Wallet, Wrench, Zap } from 'lucide-react';
import { useTools } from '@/hooks/useTools';
import { NavItem } from '@/components/app/nav-item';
import { NAV_ITEMS } from '@/config/nav';

const ICON_MAP: Record<string, React.ReactNode> = {
  Wallet: <Wallet />,
};

function ToolIcon() {
  return <Wrench />;
}

export function Sidebar() {
  const { tools, isLoading } = useTools();

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-bg-sidebar z-sidebar">
      {/* Logo + collapse */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Zap size={28} className="text-accent" />
          <span className="text-lg font-bold text-text-primary">Таймтуаск</span>
        </div>
        <button
          type="button"
          className="rounded-[var(--radius-md)] p-1 text-text-secondary transition-colors hover:bg-[var(--color-border)] hover:text-text-primary"
          aria-label="Свернуть меню"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
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
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-[var(--color-border)] hover:text-text-primary"
        >
          <Share2 size={18} />
          Поделиться
        </button>
      </div>
    </aside>
  );
}
