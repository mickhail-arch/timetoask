'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react';
import { useJobStatus } from '@/hooks/useJobStatus';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

export interface JobStep {
  name: string;
  status: 'done' | 'active' | 'pending';
}

interface JobProgressProps {
  jobId: string;
  steps?: JobStep[];
  onComplete?: (result: unknown) => void;
  onError?: (error: string) => void;
}

function StepIcon({ status }: { status: JobStep['status'] }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 size={18} className="text-success shrink-0" />;
    case 'active':
      return <Loader2 size={18} className="text-accent shrink-0 animate-spin" />;
    default:
      return <Circle size={18} className="text-text-secondary shrink-0" />;
  }
}

function computeProgress(steps: JobStep[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.status === 'done').length;
  const active = steps.filter((s) => s.status === 'active').length;
  return Math.round(((done + active * 0.5) / steps.length) * 100);
}

export function JobProgress({
  jobId,
  steps = [],
  onComplete,
  onError,
}: JobProgressProps) {
  const { data, error } = useJobStatus(jobId);
  const completedRef = useRef(false);
  const failedRef = useRef(false);

  useEffect(() => {
    if (!data) return;

    if (data.status === 'completed' && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(data.output);
    }

    if (data.status === 'failed' && !failedRef.current) {
      failedRef.current = true;
      const msg = data.error ?? 'Задача завершилась с ошибкой';
      toast.error(msg);
      onError?.(msg);
    }
  }, [data, onComplete, onError]);

  const status = data?.status ?? 'pending';
  const isActive = status === 'pending' || status === 'processing';

  const progressValue =
    status === 'completed'
      ? 100
      : status === 'failed'
        ? 100
        : steps.length > 0
          ? computeProgress(steps)
          : isActive
            ? 35
            : 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-bg-surface p-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            {status === 'completed'
              ? 'Готово'
              : status === 'failed'
                ? 'Ошибка'
                : 'Выполняется…'}
          </span>
          <span className="text-xs text-text-secondary">{progressValue}%</span>
        </div>
        <Progress
          value={progressValue}
          className={isActive ? 'animate-pulse' : undefined}
        />
      </div>

      {steps.length > 0 && (
        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.name} className="flex items-center gap-2">
              <StepIcon status={step.status} />
              <span
                className={
                  step.status === 'active'
                    ? 'text-sm font-medium text-text-primary'
                    : step.status === 'done'
                      ? 'text-sm text-text-secondary'
                      : 'text-sm text-text-secondary opacity-60'
                }
              >
                {step.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-error/10 p-3">
          <AlertCircle size={16} className="mt-0.5 text-error shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {status === 'failed' && data?.error && (
        <div className="flex items-start gap-2 rounded-lg bg-error/10 p-3">
          <AlertCircle size={16} className="mt-0.5 text-error shrink-0" />
          <p className="text-sm text-error">{data.error}</p>
        </div>
      )}
    </div>
  );
}
