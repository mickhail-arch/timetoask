//hooks/useSeoJobPolling.ts

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
  competitorMeta?: Array<{ url: string; metaTitle: string; metaDescription: string; slug: string }>;
  result?: Record<string, unknown> & {
    competitorMeta?: Array<{ url: string; metaTitle: string; metaDescription: string; slug: string }>;
    research?: { competitorMeta?: Array<{ url: string; metaTitle: string; metaDescription: string; slug: string }> };
  };
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
  const activeJobIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Активным считаем последний jobId, который пришёл в хук
    activeJobIdRef.current = jobId;

    if (!jobId) {
      setState(null);
      setIsLoading(false);
      setError(null);
      stop();
      return;
    }

    // Сбрасываем state при смене jobId, чтобы старые данные не «протекали» в новую сессию
    setState(null);
    setIsLoading(true);
    setError(null);

    const myJobId = jobId; // captured in closure для проверки актуальности
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${myJobId}/status`);
        // Если за время fetch jobId сменился — игнорируем ответ
        if (cancelled || activeJobIdRef.current !== myJobId) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled || activeJobIdRef.current !== myJobId) return;

        const data = json.data as PipelineState;
        setState(data);

        if (TERMINAL.includes(data.status)) {
          stop();
          setIsLoading(false);
        }
      } catch (err) {
        if (cancelled || activeJobIdRef.current !== myJobId) return;
        setError(err instanceof Error ? err.message : 'Ошибка получения статуса');
        stop();
        setIsLoading(false);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      stop();
    };
  }, [jobId, stop]);

  return { state, isLoading, error };
}
