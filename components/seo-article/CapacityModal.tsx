'use client';

import { useSessions, MAX_ACTIVE_GENERATIONS } from '@/contexts/SessionsContext';

export function CapacityModal() {
  const { state, activeCount, closeCapacityModal } = useSessions();

  if (!state.capacityModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={closeCapacityModal}
    >
      <div
        className="relative w-[420px] max-w-[90vw] rounded-[var(--radius-lg)] bg-[var(--seo-btn-default-bg)] p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={closeCapacityModal}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-page)] hover:text-[var(--color-text-primary)]"
          aria-label="Закрыть"
        >
          ×
        </button>

        <h2 className="mb-2 pr-6 text-[18px] font-semibold text-[var(--color-text-primary)]">
          Порядок генераций заполнен
        </h2>
        <p className="mb-1 text-[14px] text-[var(--color-text-secondary)]">
          Сейчас активно <strong className="text-[var(--color-text-primary)]">{activeCount}/{MAX_ACTIVE_GENERATIONS}</strong> генераций.
        </p>
        <p className="mb-5 text-[14px] text-[var(--color-text-secondary)]">
          Дождитесь завершения любой из активных статей или подтвердите одну из ожидающих структуру, чтобы освободить слот.
        </p>

        <button
          onClick={closeCapacityModal}
          className="w-full rounded-[var(--radius-md)] bg-[var(--seo-btn-primary-bg)] py-2.5 text-[14px] font-medium text-[var(--seo-btn-primary-text)] transition-colors hover:brightness-95"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
