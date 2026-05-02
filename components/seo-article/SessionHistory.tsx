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
  activeJobs?: Record<string, { status: string; progress: number; stepName: string }>;
  unseenIds?: string[];
}

export function SessionHistory({
  sessions,
  loading,
  activeSessionId,
  onSelect,
  onDelete,
  onNewArticle,
  activeJobs,
  unseenIds,
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

  const getStatusDot = (status: string, id?: string) => {
    switch (status) {
      case 'completed': return unseenIds?.includes(id ?? '') ? 'bg-[#34C759] animate-pulse' : 'bg-[var(--color-accent)]';
      case 'generating': return 'bg-[var(--color-accent)] animate-pulse';
      case 'awaiting_confirmation': return 'bg-[#E8A000]';
      case 'failed': return 'bg-[var(--color-step-error)]';
      case 'draft': return 'bg-[#CCC]';
      default: return 'bg-[var(--color-accent)]';
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
                <div className="flex items-start gap-1.5">
                  <span className={`mt-[3px] inline-block h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDot(s.status, s.id)}`} />
                  <span className="text-[14px] font-normal leading-[1.3] line-clamp-2 text-[var(--color-text-primary)]">
                    {s.title}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 pl-3 text-[10px] text-[var(--color-text-secondary)]">
                  <span>{formatDate(s.createdAt)}</span>
                  {s.version > 1 && <span>v{s.version}</span>}
                  {s.tokensUsed > 0 && <span>{s.tokensUsed} тк</span>}
                  {s.status === 'draft' && (
                    <span className="text-[11px] text-[var(--color-text-secondary)]">Черновик</span>
                  )}
                  {s.status === 'generating' && (
                    <span className="text-[11px] text-[var(--color-accent)]">Генерация...</span>
                  )}
                  {s.status === 'awaiting_confirmation' && (
                    <span className="text-[11px] text-[#E8A000]">Ожидает проверки</span>
                  )}
                  {s.status === 'failed' && (
                    <span className="text-[11px] text-[var(--color-step-error)]">Ошибка</span>
                  )}
                  {s.status === 'completed' && unseenIds?.includes(s.id) && (
                    <span className="text-[11px] text-[#34C759]">Готово ✓</span>
                  )}
                </div>
              </div>

              {(() => {
                const job = activeJobs?.[s.id];
                if (s.status === 'generating' || job?.status === 'processing') {
                  const progress = job?.progress ?? 0;
                  const remainingSec = progress < 15 ? 30 : progress < 50 ? 150 : progress < 90 ? 180 : 30;
                  const remainingMin = Math.ceil(remainingSec / 60);
                  return (
                    <div className="flex items-center gap-1.5" title={job?.stepName ?? 'Генерация'}>
                      <svg className="h-4 w-4 animate-spin text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span className="text-[10px] text-[var(--color-text-secondary)]">~{remainingMin} мин</span>
                    </div>
                  );
                }
                if (s.status === 'awaiting_confirmation') {
                  return (
                    <div className="flex items-center" title="Проверьте структуру статьи">
                      <svg className="h-4 w-4 text-[#E8A000]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                  );
                }
                if (s.status === 'completed' && unseenIds?.includes(s.id)) {
                  return (
                    <div className="flex items-center" title="Статья готова">
                      <svg className="h-4 w-4 text-[#34C759]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  );
                }
                return null;
              })()}

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
