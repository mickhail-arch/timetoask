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

      {/* Прогресс-бар */}
      <div className="mb-6 h-1 overflow-hidden rounded-full bg-[var(--seo-card-border)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            backgroundColor: hasError
              ? 'var(--color-step-error)'
              : 'var(--color-step-running)',
          }}
        />
      </div>

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
          className="rounded-[var(--radius-md)] border border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] px-5 py-2 text-[13px] text-[var(--color-text-primary)] transition-colors hover:bg-[#F5F5F5]"
        >
          Отменить
        </button>
      </div>
    </div>
  );
}
