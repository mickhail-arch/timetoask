'use client';

import { useState, useEffect, useRef } from 'react';
import type { JobStatus } from '@/core/types';

export interface JobStatusData {
  jobId: string;
  status: JobStatus;
  output: unknown;
  error: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

interface UseJobStatusResult {
  data: JobStatusData | null;
  isLoading: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 2_000;
const TERMINAL_STATUSES: JobStatus[] = ['completed', 'failed'];

export function useJobStatus(jobId: string | null): UseJobStatusResult {
  const [data, setData] = useState<JobStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setData(null);
    setError(null);

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const jobData: JobStatusData = json.data;
        setData(jobData);
        setError(null);

        if (TERMINAL_STATUSES.includes(jobData.status)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch job status');
        setIsLoading(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId]);

  return { data, isLoading, error };
}
