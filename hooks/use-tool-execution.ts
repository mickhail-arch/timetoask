'use client';

import { useState, useCallback, useRef } from 'react';

interface UseToolExecutionOptions {
  slug: string;
  executionMode: 'sync' | 'async';
}

interface UseToolExecutionResult {
  execute: (formData: Record<string, unknown>) => Promise<void>;
  streamContent: string;
  isExecuting: boolean;
  isStreaming: boolean;
  jobId: string | null;
  result: unknown;
  error: string | null;
  reset: () => void;
}

export function useToolExecution({
  slug,
  executionMode,
}: UseToolExecutionOptions): UseToolExecutionResult {
  const [streamContent, setStreamContent] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamContent('');
    setIsExecuting(false);
    setIsStreaming(false);
    setJobId(null);
    setResult(null);
    setError(null);
  }, []);

  const execute = useCallback(
    async (formData: Record<string, unknown>) => {
      setError(null);
      setStreamContent('');
      setResult(null);
      setJobId(null);
      setIsExecuting(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/tools/${slug}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: formData }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
        }

        if (executionMode === 'async') {
          const json = await res.json();
          setJobId(json.data.jobId);
          return;
        }

        // Sync mode: read SSE stream
        setIsStreaming(true);
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setStreamContent(accumulated);
        }

        setIsStreaming(false);
        setIsExecuting(false);
        setResult(accumulated);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        setIsStreaming(false);
        setIsExecuting(false);
      }
    },
    [slug, executionMode],
  );

  return {
    execute,
    streamContent,
    isExecuting,
    isStreaming,
    jobId,
    result,
    error,
    reset,
  };
}
