'use client';

import { useBalance } from '@/hooks/useBalance';
import { cn } from '@/lib/utils';

export function BalanceWidget() {
  const { balance, isLoading, error } = useBalance();

  if (isLoading) {
    return (
      <span className="inline-block w-[60px] h-[20px] rounded bg-[var(--color-border)] animate-pulse" />
    );
  }

  if (error || !balance) {
    return <span className="text-sm text-text-secondary">&mdash;</span>;
  }

  const available = balance.available;

  return (
    <span
      className={cn(
        'text-sm font-bold',
        available <= 0 ? 'text-error' : 'text-text-primary',
      )}
    >
      {available} тк
    </span>
  );
}
