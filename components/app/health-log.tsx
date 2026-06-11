'use client';

import { useEffect, useState } from 'react';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';

interface Row {
  id: string;
  model: string;
  label: string;
  status: string;
  response: string | null;
  errorMessage: string | null;
  tokens: number;
  costRub: number;
  latencyMs: number;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  ok: 'text-green-500',
  down: 'text-[var(--color-step-error)]',
};

export function HealthLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    fetch(`/api/admin/health/log?${p.toString()}`)
      .then((r) => r.json())
      .then((j) => (j.data ? setRows(j.data) : setError(j.error?.message ?? 'Ошибка')))
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <div className="space-y-3">
      <DateRangePicker
        value={{ from: from || null, to: to || null }}
        onApply={(r: DateRange) => { setFrom(r.from ?? ''); setTo(r.to ?? ''); }}
      />
      {loading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Загрузка...</p>
      ) : error ? (
        <p className="text-sm text-[var(--color-step-error)]">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Проверок за период нет.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-bg-surface)] text-left text-[var(--color-text-secondary)]">
          <tr>
            <th className="px-4 py-2 font-medium">Модель</th>
            <th className="px-4 py-2 font-medium">Статус</th>
            <th className="px-4 py-2 font-medium">Ответ / ошибка</th>
            <th className="px-4 py-2 font-medium text-right">Токены</th>
            <th className="px-4 py-2 font-medium text-right">Цена</th>
            <th className="px-4 py-2 font-medium text-right">Латентность</th>
            <th className="px-4 py-2 font-medium text-right">Когда</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-4 py-2 text-[var(--color-text-primary)]">{r.label}</td>
              <td className={`px-4 py-2 font-medium ${STATUS_STYLE[r.status] ?? 'text-[var(--color-text-secondary)]'}`}>{r.status}</td>
              <td className="max-w-[320px] truncate px-4 py-2 text-[var(--color-text-secondary)]">{r.response ?? r.errorMessage ?? '—'}</td>
              <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{r.tokens}</td>
              <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{r.costRub} ₽</td>
              <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{r.latencyMs} мс</td>
              <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
            </tr>
          ))}
        </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
