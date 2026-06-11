'use client';

import { useEffect, useState } from 'react';

interface Stats { code: string; invited: number; earned: number; }

export function ReferralClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => {
    fetch('/api/referral')
      .then((r) => r.json())
      .then((j) => (j.data ? setStats(j.data) : setError(j.error?.message ?? 'Ошибка')))
      .catch(() => setError('Ошибка загрузки'));
  }, []);

  useEffect(() => {
    if (stats) setLink(`${window.location.origin}/?r=${stats.code}`);
  }, [stats]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  if (error) return <p className="text-sm text-[var(--color-step-error)]">{error}</p>;
  if (!stats) return <p className="text-sm text-[var(--color-text-secondary)]">Загрузка...</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Ваша ссылка</div>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-[var(--color-bg-page)] px-3 py-2 text-[13px] text-[var(--color-text-primary)]"
          />
          <button
            onClick={copy}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-[13px] font-medium text-black transition-colors hover:brightness-90"
          >
            {copied ? '✓ Скопировано' : 'Скопировать'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Приглашено</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.invited}</div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Заработано</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.earned.toLocaleString('ru-RU')} ₽</div>
        </div>
      </div>
    </div>
  );
}
