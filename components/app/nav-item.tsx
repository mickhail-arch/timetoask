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
}

export function NavItem({ icon, label, href, badge }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent text-text-primary'
          : 'text-text-secondary hover:bg-[var(--color-border)] hover:text-text-primary',
      )}
    >
      <span className="shrink-0 [&>svg]:size-[18px]">{icon}</span>
      <span className="truncate">{label}</span>
      {badge && (
        <Badge
          className="ml-auto border-transparent bg-accent text-text-primary text-[10px] px-1.5 py-0"
        >
          {badge}
        </Badge>
      )}
    </Link>
  );
}
