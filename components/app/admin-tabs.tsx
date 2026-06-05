'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Вкладки админки. Новые добавляются сюда одной строкой.
const TABS = [
  { label: 'Доступы', href: '/admin/users' },
  { label: 'Аналитика', href: '/admin/analytics' },
  { label: 'Журнал', href: '/admin/activity' },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-[var(--color-accent)] text-[var(--color-text-primary)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
