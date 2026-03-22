'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface PipelineState {
  jobId: string;
  status: 'processing' | 'awaiting_confirmation' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  stepName: string;
  progress: number;
  partialData?: string;
  brief?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  failedStep?: string;
  calculatedPrice?: number;
  priceBreakdown?: { base: number; chars: number; images: number; faq: number; total: number };
  qualityMetrics?: Record<string, number>;
  warnings?: string[];
}

const POLL_INTERVAL = 2000;
const TERMINAL = ['completed', 'failed'];

export function useSeoJobPolling(jobId: string | null) {
  const [state, setState] = useState<PipelineState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setState(null);
      setIsLoading(false);
      setError(null);
      stop();
      return;
    }

    setIsLoading(true);
    setError(null);

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data = json.data as PipelineState;
        setState(data);

        if (TERMINAL.includes(data.status)) {
          stop();
          setIsLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка получения статуса');
        stop();
        setIsLoading(false);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return stop;
  }, [jobId, stop]);

  return { state, isLoading, error };
}
