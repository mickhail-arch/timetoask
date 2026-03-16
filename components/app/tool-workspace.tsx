'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToolExecution } from '@/hooks/use-tool-execution';
import { useBalance } from '@/hooks/useBalance';
import { AutoForm } from '@/components/app/auto-form';
import { StreamResult } from '@/components/app/stream-result';
import { JobProgress } from '@/components/app/job-progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface JSONSchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  definitions?: Record<string, unknown>;
  $defs?: Record<string, unknown>;
}

interface ToolSchemaResponse {
  inputSchema: JSONSchema;
  outputFormat: string;
}

export interface ToolWorkspacePlugin {
  id: string;
  slug: string;
  name: string;
  executionMode: 'sync' | 'async';
  tokenCost: number;
  freeUsesLimit: number;
  outputFormat: string;
}

interface ToolWorkspaceProps {
  plugin: ToolWorkspacePlugin;
}

type Phase = 'idle' | 'executing' | 'done';

export function ToolWorkspace({ plugin }: ToolWorkspaceProps) {
  const [schemaData, setSchemaData] = useState<ToolSchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [asyncResult, setAsyncResult] = useState<unknown>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  const { balance } = useBalance();

  const {
    execute,
    streamContent,
    isExecuting,
    isStreaming,
    jobId,
    error: execError,
    reset: resetExecution,
  } = useToolExecution({
    slug: plugin.slug,
    executionMode: plugin.executionMode,
  });

  // Fetch JSON Schema on mount
  useEffect(() => {
    let cancelled = false;
    setSchemaLoading(true);
    setSchemaError(null);

    fetch(`/api/tools/${plugin.slug}/schema`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setSchemaData(json.data);
      })
      .catch((err) => {
        if (!cancelled)
          setSchemaError(err instanceof Error ? err.message : 'Ошибка загрузки схемы');
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false);
      });

    return () => { cancelled = true; };
  }, [plugin.slug]);

  // Track phase transitions
  useEffect(() => {
    if (isExecuting || isStreaming || jobId) {
      setPhase('executing');
    }
  }, [isExecuting, isStreaming, jobId]);

  useEffect(() => {
    if (!isExecuting && !isStreaming && !jobId && phase === 'executing') {
      setPhase('done');
    }
  }, [isExecuting, isStreaming, jobId, phase]);

  useEffect(() => {
    if (execError) {
      toast.error(execError);
      setPhase('idle');
    }
  }, [execError]);

  const handleSubmit = useCallback(
    (data: Record<string, unknown>) => {
      setAsyncResult(null);
      execute(data);
    },
    [execute],
  );

  const handleReset = useCallback(() => {
    resetExecution();
    setAsyncResult(null);
    setPhase('idle');
  }, [resetExecution]);

  const handleJobComplete = useCallback(
    (result: unknown) => {
      setAsyncResult(result);
      setPhase('done');
    },
    [],
  );

  const handleJobError = useCallback(() => {
    setPhase('idle');
  }, []);

  const showResult = phase === 'executing' || phase === 'done';
  const isSyncMode = plugin.executionMode === 'sync';

  // Schema loading skeleton
  if (schemaLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded-[var(--radius-md)] bg-bg-sidebar" />
            <div className="h-11 w-full animate-pulse rounded-[var(--radius-md)] bg-bg-sidebar" />
          </div>
        ))}
        <div className="h-11 w-full animate-pulse rounded-[var(--radius-md)] bg-bg-sidebar" />
      </div>
    );
  }

  if (schemaError) {
    return (
      <p className="rounded-lg bg-error/10 p-4 text-sm text-error">{schemaError}</p>
    );
  }

  if (!schemaData) return null;

  const outputFormat = schemaData.outputFormat ?? plugin.outputFormat;

  return (
    <div
      className={cn(
        'flex gap-6',
        showResult ? 'flex-col md:flex-row' : 'flex-col',
      )}
    >
      {/* Form panel */}
      <div className={cn(showResult ? 'w-full md:w-2/5 md:shrink-0' : 'w-full')}>
        <AutoForm
          schema={schemaData.inputSchema as Parameters<typeof AutoForm>[0]['schema']}
          onSubmit={handleSubmit}
          loading={isExecuting || isStreaming}
          tokenCost={plugin.tokenCost}
          freeUsesLeft={plugin.freeUsesLimit}
          balance={balance?.available ?? null}
        />
      </div>

      {/* Result panel */}
      {showResult && (
        <div className="w-full md:w-3/5">
          {isSyncMode ? (
            <StreamResult
              content={streamContent}
              isStreaming={isStreaming}
              outputFormat={outputFormat}
              onReset={phase === 'done' ? handleReset : undefined}
            />
          ) : jobId && !asyncResult ? (
            <JobProgress
              jobId={jobId}
              onComplete={handleJobComplete}
              onError={handleJobError}
            />
          ) : asyncResult ? (
            <StreamResult
              content={
                typeof asyncResult === 'string'
                  ? asyncResult
                  : JSON.stringify(asyncResult, null, 2)
              }
              isStreaming={false}
              outputFormat={outputFormat}
              onReset={handleReset}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
