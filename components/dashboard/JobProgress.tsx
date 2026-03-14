'use client';

import { useJobStatus } from '@/hooks/useJobStatus';
import { ToolResult } from './ToolResult';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { JobStatus } from '@/core/types';

interface JobProgressProps {
  jobId: string;
  outputFormat?: string;
}

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'В очереди',
  processing: 'Выполняется',
  completed: 'Завершено',
  failed: 'Ошибка',
};

const STATUS_VARIANT: Record<
  JobStatus,
  'secondary' | 'default' | 'destructive' | 'outline'
> = {
  pending: 'secondary',
  processing: 'default',
  completed: 'outline',
  failed: 'destructive',
};

function indeterminateProgress(status: JobStatus): number {
  if (status === 'pending') return 20;
  if (status === 'processing') return 65;
  if (status === 'completed') return 100;
  return 100;
}

export function JobProgress({ jobId, outputFormat = 'json' }: JobProgressProps) {
  const { data, isLoading, error } = useJobStatus(jobId);

  const status = data?.status ?? 'pending';
  const isActive = status === 'pending' || status === 'processing';

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">Задача</CardTitle>
        <Badge variant={STATUS_VARIANT[status]}>
          {STATUS_LABEL[status]}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Progress
            value={indeterminateProgress(status)}
            className={isActive ? 'animate-pulse' : undefined}
          />
          <p className="text-xs text-muted-foreground">
            {isActive
              ? 'Пожалуйста, подождите…'
              : status === 'completed'
              ? 'Готово'
              : 'Задача завершилась с ошибкой'}
          </p>
        </div>

        {isLoading && !data && (
          <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {status === 'failed' && data?.error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {data.error}
          </p>
        )}

        {status === 'completed' && data?.output != null && (
          <ToolResult result={data.output} outputFormat={outputFormat} />
        )}

        {data?.startedAt && (
          <p className="text-xs text-muted-foreground">
            Запущено:{' '}
            {new Date(data.startedAt).toLocaleTimeString('ru-RU')}
            {data.endedAt && (
              <>
                {' '}· Завершено:{' '}
                {new Date(data.endedAt).toLocaleTimeString('ru-RU')}
              </>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
