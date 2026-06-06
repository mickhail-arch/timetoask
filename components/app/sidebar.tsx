//components/app/sidebar.tsx

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Share2, Wallet, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useTools } from '@/hooks/useTools';
import { NavItem } from '@/components/app/nav-item';
import { NAV_ITEMS } from '@/config/nav';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ICON_MAP: Record<string, React.ReactNode> = {
  Wallet: <Wallet />,
};

const SLUG_TO_URL: Record<string, string> = {
  'seo-article-express': 'seo-article',
};

const SLUG_TO_NAME: Record<string, string> = {
  'seo-article-express': 'SEO-статья',
};

function getToolUrl(slug: string): string {
  return `/tools/${SLUG_TO_URL[slug] ?? slug}`;
}

function getToolName(slug: string, name: string): string {
  return SLUG_TO_NAME[slug] ?? name;
}

function ToolIcon() {
  return <Wrench />;
}

interface ShareButtonProps {
  collapsed: boolean;
}

function ShareButton({ collapsed }: ShareButtonProps) {
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
    <Button
      type="button"
      variant="ghost"
      onClick={handleShare}
      title={collapsed ? 'Поделиться' : undefined}
      className="w-full justify-start gap-3 h-9 px-2.5 text-muted-foreground hover:text-foreground"
    >
      <Share2 className="size-[18px] shrink-0" />
      <span
        className={cn(
          'truncate transition-opacity duration-150',
          collapsed && 'pointer-events-none opacity-0',
        )}
      >
        Поделиться
      </span>
    </Button>
  );
}

export function Sidebar() {
  const { tools, isLoading } = useTools();
  const [hovered, setHovered] = useState(false);
  const collapsed = !hovered;

  return (
    <>
      {/* Placeholder для bg, чтобы контент не прыгал. Ширина = свернутая. */}
      <div className="w-[56px] shrink-0" aria-hidden />

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'fixed left-0 top-0 z-sidebar flex h-screen flex-col border-r border-border bg-card transition-[width] duration-200 ease-out',
          collapsed ? 'w-[56px]' : 'w-[240px] shadow-xl',
        )}
      >
        {/* Logo: иконка в свёрнутом, полный логотип в раскрытом. Высота одинаковая. */}
        <div className="flex h-14 items-center px-3 overflow-hidden">
          <Link href="/tools" className="flex h-8 items-center shrink-0">
            {collapsed ? (
              <Image
                src="/logo-icon.svg"
                alt="Таймтуаск"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0"
                priority
              />
            ) : (
              <>
                <Image
                  src="/logo.svg"
                  alt="Таймтуаск"
                  width={318}
                  height={54}
                  className="block h-8 w-auto shrink-0 dark:hidden"
                  priority
                />
                <Image
                  src="/logo-white.svg"
                  alt="Таймтуаск"
                  width={318}
                  height={54}
                  className="hidden h-8 w-auto shrink-0 dark:block"
                  priority
                />
              </>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 py-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-9 rounded-md bg-muted animate-pulse"
              />
            ))
          ) : (
            tools.map((tool) => (
              <NavItem
                key={tool.id}
                icon={<ToolIcon />}
                label={getToolName(tool.slug, tool.name)}
                href={getToolUrl(tool.slug)}
                collapsed={collapsed}
              />
            ))
          )}

          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              icon={ICON_MAP[item.icon] ?? <Wallet />}
              label={item.label}
              href={item.href}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Bottom: Theme + Share */}
        <div className="flex flex-col gap-1 border-t border-border px-2 py-2">
          <ThemeToggle collapsed={collapsed} />
          <ShareButton collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}
