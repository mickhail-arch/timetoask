'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  badge?: string;
  /** true — родительский сайдбар свёрнут, текст скрываем, но оставляем для tooltip */
  collapsed?: boolean;
}

export function NavItem({ icon, label, href, badge, collapsed }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'group/navitem relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent/15 text-foreground'
          : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:size-[18px]',
          isActive && 'text-[var(--color-accent)]',
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          'truncate transition-opacity duration-150',
          collapsed && 'pointer-events-none opacity-0',
        )}
      >
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </span>
      {badge && !collapsed && (
        <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px]">
          {badge}
        </Badge>
      )}
      {isActive && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-[var(--color-accent)]"
        />
      )}
    </Link>
  );
}
