'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Balance {
  amount: string;
  reserved: string;
  available: number;
  updatedAt: string;
}

interface UseBalanceResult {
  balance: Balance | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 30_000;

export function useBalance(): UseBalanceResult {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/balance');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const raw = json.data;
      setBalance({
        amount: raw.amount,
        reserved: raw.reserved,
        available: parseFloat(raw.amount) - parseFloat(raw.reserved),
        updatedAt: raw.updatedAt,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    const id = setInterval(fetchBalance, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchBalance]);

  return { balance, isLoading, error, refetch: fetchBalance };
}
