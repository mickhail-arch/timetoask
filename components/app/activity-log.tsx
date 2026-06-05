'use client';

import { useEffect, useState } from 'react';

interface Row {
  id: string;
  email: string;
  title: string;
  status: string;
  tokens: number;
  revenue: number;
  cost: number;
  profit: number;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'text-green-500',
  failed: 'text-[var(--color-step-error)]',
  generating: 'text-[var(--color-accent)]',
  awaiting_confirmation: 'text-yellow-500',
};

export function ActivityLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/activity')
      .then((r) => r.json())
      .then((j) => (j.data ? setRows(j.data) : setError(j.error?.message ?? 'Ошибка')))
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-[var(--color-text-secondary)]">Загрузка...</p>;
  if (error) return <p className="text-sm text-[var(--color-step-error)]">{error}</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-bg-surface)] text-left text-[var(--color-text-secondary)]">
          <tr>
            <th className="px-4 py-2 font-medium">Аккаунт</th>
            <th className="px-4 py-2 font-medium">Статья</th>
            <th className="px-4 py-2 font-medium">Статус</th>
            <th className="px-4 py-2 font-medium text-right">Доход</th>
            <th className="px-4 py-2 font-medium text-right">Себест.</th>
            <th className="px-4 py-2 font-medium text-right">Прибыль</th>
            <th className="px-4 py-2 font-medium text-right">Токены</th>
            <th className="px-4 py-2 font-medium text-right">Когда</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-4 py-2 text-[var(--color-text-primary)]">{r.email}</td>
              <td className="max-w-[280px] truncate px-4 py-2 text-[var(--color-text-secondary)]">{r.title}</td>
              <td className={`px-4 py-2 font-medium ${STATUS_STYLE[r.status] ?? 'text-[var(--color-text-secondary)]'}`}>{r.status}</td>
              <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{r.revenue} ₽</td>
              <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{r.cost} ₽</td>
              <td className={`px-4 py-2 text-right font-medium ${r.profit >= 0 ? 'text-green-500' : 'text-[var(--color-step-error)]'}`}>{r.profit} ₽</td>
              <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{r.tokens}</td>
              <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
