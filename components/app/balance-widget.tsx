'use client';

import { useBalance } from '@/hooks/useBalance';

export function BalanceWidget() {
  const { balance, isLoading, error } = useBalance();

  if (isLoading) {
    return (
      <span className="inline-block w-[60px] h-[20px] rounded bg-[var(--color-border)] animate-pulse" />
    );
  }

  if (error || !balance) {
    return <span className="text-sm text-[var(--color-text-secondary)]">&mdash;</span>;
  }

  const available = balance.available;

  return (
    <span
      className={
        available <= 0
          ? 'text-sm font-normal text-[var(--color-error)]'
          : 'text-sm font-normal text-[var(--color-text-secondary)]'
      }
    >
      {available.toLocaleString('ru-RU')} ₽
    </span>
  );
}
