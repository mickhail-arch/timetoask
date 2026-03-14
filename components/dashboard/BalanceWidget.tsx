'use client';

import { useBalance } from '@/hooks/useBalance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wallet } from 'lucide-react';

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className ?? 'h-4 w-24'}`}
    />
  );
}

function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
  }).format(value);
}

export function BalanceWidget() {
  const { balance, isLoading, error, refetch } = useBalance();

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="size-4 text-muted-foreground" />
          Баланс
        </CardTitle>
        <button
          type="button"
          onClick={refetch}
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Обновить баланс"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : isLoading ? (
          <div className="space-y-2">
            <SkeletonLine className="h-8 w-32" />
            <SkeletonLine className="h-3 w-40" />
          </div>
        ) : balance ? (
          <>
            <div>
              <p className="text-2xl font-bold tracking-tight">
                {formatRub(balance.available)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Доступно &bull; Зарезервировано:{' '}
                <span className="font-medium text-foreground">
                  {formatRub(parseFloat(balance.reserved))}
                </span>
              </p>
            </div>

            {balance.available < 50 && (
              <Badge variant="destructive" className="text-xs">
                Низкий баланс
              </Badge>
            )}
          </>
        ) : null}

        <Button className="w-full" variant="outline" disabled>
          Пополнить
        </Button>
      </CardContent>
    </Card>
  );
}
