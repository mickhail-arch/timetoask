'use client';

import { useCallback, useEffect, useState } from 'react';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';

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

type SortKey = 'date' | 'email' | 'revenue' | 'cost' | 'profit' | 'tokens';
type Dir = 'asc' | 'desc';

const STATUS_STYLE: Record<string, string> = {
  completed: 'text-green-500',
  failed: 'text-[var(--color-step-error)]',
  generating: 'text-[var(--color-accent)]',
  awaiting_confirmation: 'text-yellow-500',
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ActivityLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortKey>('date');
  const [dir, setDir] = useState<Dir>('desc');

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (email) p.set('email', email);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    p.set('sort', sort);
    p.set('dir', dir);
    fetch(`/api/admin/activity?${p.toString()}`)
      .then((r) => r.json())
      .then((j) => (j.data ? setRows(j.data) : setError(j.error?.message ?? 'Ошибка')))
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [email, from, to, sort, dir]);

  // первичная загрузка и при изменении сортировки/дат — сразу
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sort, dir, from, to]);

  const preset = (kind: 'today' | 'yesterday' | 'all' | number) => {
    const now = new Date();
    if (kind === 'all') { setFrom(''); setTo(''); return; }
    if (kind === 'today') { setFrom(ymd(now)); setTo(ymd(now)); return; }
    if (kind === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); setFrom(ymd(y)); setTo(ymd(y)); return; }
    const f = new Date(now); f.setDate(f.getDate() - (kind - 1)); setFrom(ymd(f)); setTo(ymd(now));
  };

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(key); setDir('desc'); }
  };
  const arrow = (key: SortKey) => (sort === key ? (dir === 'asc' ? ' ↑' : ' ↓') : '');

  const presetBtn = 'rounded-md border border-[var(--seo-card-border)] px-3 py-1 text-[12px] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]';
  const inputCls = 'rounded-md border border-[var(--seo-input-border)] bg-[var(--color-bg-page)] px-2 py-1.5 text-[13px] text-[var(--color-text-primary)]';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          placeholder="Поиск по email"
          className={`${inputCls} w-56`}
        />
        <DateRangePicker
          value={{ from: from || null, to: to || null }}
          onApply={(r: DateRange) => { setFrom(r.from ?? ''); setTo(r.to ?? ''); }}
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Загрузка...</p>
      ) : error ? (
        <p className="text-sm text-[var(--color-step-error)]">{error}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-surface)] text-left text-[var(--color-text-secondary)]">
              <tr>
                <th className="cursor-pointer select-none px-4 py-2 font-medium" onClick={() => toggleSort('email')}>Аккаунт{arrow('email')}</th>
                <th className="px-4 py-2 font-medium">Статья</th>
                <th className="px-4 py-2 font-medium">Статус</th>
                <th className="cursor-pointer select-none px-4 py-2 font-medium text-right" onClick={() => toggleSort('revenue')}>Доход{arrow('revenue')}</th>
                <th className="cursor-pointer select-none px-4 py-2 font-medium text-right" onClick={() => toggleSort('cost')}>Себест.{arrow('cost')}</th>
                <th className="cursor-pointer select-none px-4 py-2 font-medium text-right" onClick={() => toggleSort('profit')}>Прибыль{arrow('profit')}</th>
                <th className="cursor-pointer select-none px-4 py-2 font-medium text-right" onClick={() => toggleSort('tokens')}>Токены{arrow('tokens')}</th>
                <th className="cursor-pointer select-none px-4 py-2 font-medium text-right" onClick={() => toggleSort('date')}>Когда{arrow('date')}</th>
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
      )}
    </div>
  );
}
