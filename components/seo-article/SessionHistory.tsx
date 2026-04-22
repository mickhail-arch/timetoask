'use client';

import { useState } from 'react';
import type { SessionSummary } from '@/hooks/useSessionHistory';
import '@/components/seo-article/tokens.css';

interface SessionHistoryProps {
  sessions: SessionSummary[];
  loading: boolean;
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onNewArticle: () => void;
}

export function SessionHistory({
  sessions,
  loading,
  activeSessionId,
  onSelect,
  onDelete,
  onNewArticle,
}: SessionHistoryProps) {
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const deleteSession = sessions.find(s => s.id === deleteModalId);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Вчера';
    if (days < 7) return `${days} дн. назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-[var(--color-step-done)]';
      case 'generating': return 'bg-[var(--color-step-running)]';
      case 'failed': return 'bg-[var(--color-step-error)]';
      case 'draft': return 'bg-[var(--color-step-pending)]';
      default: return 'bg-[var(--color-step-pending)]';
    }
  };

  return (
    <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-[var(--seo-card-border)] bg-[#FAFAFA]">
      {/* Заголовок + кнопка */}
      <div className="flex items-center justify-between border-b border-[var(--seo-card-border)] px-3 py-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          История
        </span>
        <button
          onClick={onNewArticle}
          className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-medium text-black transition-colors hover:brightness-90"
        >
          + Новая
        </button>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-3 py-4 text-center text-[11px] text-[var(--color-text-secondary)]">
            Загрузка...
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] text-[var(--color-text-secondary)]">
            Пока нет статей
          </div>
        )}

        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group cursor-pointer border-b border-[#F0F0F0] px-3 py-2.5 transition-colors ${
              activeSessionId === s.id
                ? 'bg-white border-l-2 border-l-[var(--color-accent)]'
                : 'hover:bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDot(s.status)}`} />
                  <span className="truncate text-[12px] font-medium text-[var(--color-text-primary)]">
                    {s.title}
                  </span>
                  {s.status === 'draft' && (
                    <span className="ml-1 text-[10px] text-[var(--color-text-secondary)]">Черновик</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)]">
                  <span>{formatDate(s.createdAt)}</span>
                  {s.version > 1 && <span>v{s.version}</span>}
                  {s.tokensUsed > 0 && <span>{s.tokensUsed} тк</span>}
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setDeleteModalId(s.id); }}
                className="shrink-0 text-[12px] text-[var(--color-step-pending)] opacity-0 transition-opacity group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {deleteModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteModalId(null)}>
          <div className="w-[320px] rounded-[var(--radius-lg)] bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 text-[14px] font-medium text-[var(--color-text-primary)]">
              Вы точно хотите удалить статью?
            </div>
            <div className="mb-4 truncate text-[13px] text-[var(--color-text-secondary)]">
              {deleteSession?.title}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete(deleteModalId); setDeleteModalId(null); }}
                className="flex-1 rounded-[var(--radius-md)] bg-[#DC2626] py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#B91C1C]"
              >
                Удалить
              </button>
              <button
                onClick={() => setDeleteModalId(null)}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--seo-card-border)] bg-white py-2 text-[13px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[#F5F5F5]"
              >
                Оставить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
