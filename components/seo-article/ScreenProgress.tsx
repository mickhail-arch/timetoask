'use client';

import { StepIndicator } from './StepIndicator';
import '@/components/seo-article/tokens.css';

export interface ProgressStep {
  name: string;
  description: string;
  status: 'done' | 'running' | 'pending' | 'error';
  timeLabel: string;
  partialText?: string;
}

interface ScreenProgressProps {
  title: string;
  subtitle: string;
  steps: ProgressStep[];
  progress: number;
  currentStepLabel: string;
  onCancel: () => void;
  onRetry?: () => void;
}

export function ScreenProgress({
  title,
  subtitle,
  steps,
  progress,
  currentStepLabel,
  onCancel,
  onRetry,
}: ScreenProgressProps) {
  const doneCount = steps.filter(s => s.status === 'done').length;
  const hasError = steps.some(s => s.status === 'error');

  return (
    <div className="mx-auto max-w-[580px]">
      {/* Заголовок */}
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
        {title}
      </div>
      <div className="mb-1 text-xl font-medium text-[var(--color-text-primary)]">
        {subtitle}
      </div>

      {/* Прогресс-бар: 2 сегмента — структура (20%) и статья (80%) */}
      {(() => {
        const p = Math.min(100, Math.max(0, progress));
        const seg1 = Math.min(100, (p / 20) * 100);
        const seg2 = Math.min(100, Math.max(0, ((p - 20) / 80) * 100));
        const fillColor = hasError
          ? 'var(--color-step-error)'
          : 'var(--color-step-running)';
        return (
          <div className="mb-6">
            <div className="flex h-1 items-stretch gap-1">
              <div
                className="h-full overflow-hidden rounded-full bg-[var(--seo-card-border)]"
                style={{ flexBasis: '20%' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${seg1}%`, backgroundColor: fillColor }}
                />
              </div>
              <div
                className="h-full overflow-hidden rounded-full bg-[var(--seo-card-border)]"
                style={{ flexBasis: '80%' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${seg2}%`, backgroundColor: fillColor }}
                />
              </div>
            </div>
            <div className="mt-1.5 flex gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
              <span style={{ flexBasis: '20%' }}>Структура</span>
              <span style={{ flexBasis: '80%' }}>Текст статьи</span>
            </div>
          </div>
        );
      })()}

      {/* Список шагов */}
      <div className="mb-6 space-y-3">
        {steps.map((step, i) => (
          <StepIndicator
            key={i}
            name={step.name}
            description={step.description}
            status={step.status}
            timeLabel={step.timeLabel}
            partialText={step.partialText}
            onRetry={step.status === 'error' ? onRetry : undefined}
          />
        ))}
      </div>

      {/* Футер */}
      <div className="flex items-center justify-between border-t border-[var(--seo-card-border)] pt-4">
        <div className="text-[13px] text-[var(--color-text-secondary)]">
          {hasError ? (
            <span className="text-[var(--color-step-error)]">
              Ошибка на шаге <strong className="font-medium text-[var(--color-text-primary)]">{doneCount + 1} из {steps.length}</strong>
            </span>
          ) : (
            <>
              Шаг <strong className="font-medium text-[var(--color-text-primary)]">{doneCount + 1} из {steps.length}</strong>
              {currentStepLabel && <> · {currentStepLabel}</>}
            </>
          )}
        </div>
        <button
          onClick={onCancel}
          className="rounded-[var(--radius-md)] border border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] px-5 py-2 text-[13px] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-page)]"
        >
          Отменить
        </button>
      </div>
    </div>
  );
}
