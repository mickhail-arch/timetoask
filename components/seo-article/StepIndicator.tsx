'use client';

interface StepIndicatorProps {
  name: string;
  description: string;
  status: 'done' | 'running' | 'pending' | 'error';
  timeLabel: string;
  partialText?: string;
  onRetry?: () => void;
}

export function StepIndicator({ name, description, status, timeLabel, partialText, onRetry }: StepIndicatorProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[var(--radius-md)] border p-3.5 transition-all ${
        status === 'done' ? 'border-[var(--seo-card-border)] bg-[var(--seo-card-bg)]' :
        status === 'running' ? 'border-[var(--color-step-running)] bg-[var(--color-brief-bg)]' :
        status === 'error' ? 'border-[var(--color-step-error)] bg-[#FFF5F5]' :
        'border-transparent bg-transparent'
      }`}
    >
      {/* Dot */}
      <div
        className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
          status === 'done' ? 'bg-[var(--color-step-done)]' :
          status === 'running' ? 'bg-[var(--color-step-running)]' :
          status === 'error' ? 'bg-[var(--color-step-error)]' :
          'border border-[var(--seo-card-border)] bg-[#F5F5F5]'
        }`}
      >
        {status === 'done' && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {status === 'running' && (
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        )}
        {status === 'pending' && (
          <span className="block h-1.5 w-1.5 rounded-full bg-[var(--color-step-pending)]" />
        )}
        {status === 'error' && (
          <span className="text-xs font-bold text-white">!</span>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{name}</div>
        <div className={`text-xs ${status === 'error' ? 'text-[var(--color-step-error)]' : 'text-[var(--color-text-secondary)]'}`}>
          {description}
        </div>
        {status === 'running' && partialText && (
          <div className="mt-2 rounded-[var(--radius-sm)] border border-[var(--seo-card-border)] bg-white p-2.5 text-[13px] leading-relaxed text-[var(--color-text-primary)]">
            <span dangerouslySetInnerHTML={{ __html: partialText }} />
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-[var(--color-step-running)]" />
          </div>
        )}
        {status === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="mt-1.5 rounded-[var(--radius-sm)] border border-[var(--color-step-error)] bg-white px-3 py-1 text-[11px] text-[var(--color-step-error)] transition-colors hover:bg-[#FFF5F5]"
          >
            Повторить шаг
          </button>
        )}
      </div>

      {/* Time */}
      <div className="shrink-0 text-xs text-[var(--color-text-secondary)]">{timeLabel}</div>
    </div>
  );
}
