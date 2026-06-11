'use client';
import { useEffect, useState } from 'react';

type Status = 'ok' | 'degraded' | 'down' | 'unknown';
interface Result { id: string; label: string; status: Status; detail?: string; latencyMs?: number; checkedAt: string; }

const DOT: Record<Status, string> = {
  ok: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
  unknown: 'bg-[var(--color-text-secondary)]',
};
const WORD: Record<Status, string> = {
  ok: 'работает штатно',
  degraded: 'есть замечания',
  down: 'недоступно',
  unknown: 'нет данных',
};

export function HealthStatus() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = (force = false) => {
    setLoading(true);
    fetch(`/api/admin/health${force ? '?force=1' : ''}`)
      .then((r) => r.json())
      .then((j) => { if (j.data?.results) setResults(j.data.results); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(false); }, []);

  if (!results) {
    return <div className="rounded-xl border border-border bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-text-secondary)]">Проверка статуса…</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {results.map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-bg-surface)] px-3 py-2">
          <span className={`size-2 shrink-0 rounded-full ${DOT[r.status]}`} />
          <span className="text-[12px] text-[var(--color-text-primary)] whitespace-nowrap">{r.label}</span>
          {r.status !== 'ok' && r.detail && (
            <span className="text-[10px] text-[var(--color-text-secondary)] whitespace-nowrap">({r.detail})</span>
          )}
          {typeof r.latencyMs === 'number' && (
            <span className="text-[11px] text-[var(--color-text-secondary)] whitespace-nowrap">· {r.latencyMs} мс</span>
          )}
        </div>
      ))}
      <button
        onClick={() => load(true)}
        disabled={loading}
        className="rounded-lg border border-border bg-[var(--color-bg-surface)] px-3 py-2 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50"
      >
        {loading ? 'Проверяю…' : '↻ Проверить сейчас'}
      </button>
    </div>
  );
}
