'use client';

import { useEffect, useRef } from 'react';
import { useSessions, type JobStateSnapshot } from '@/contexts/SessionsContext';

const POLL_INTERVAL = 2000;
const TERMINAL = new Set(['completed', 'failed']);

interface SessionPollerProps {
  sessionId: string;
  jobId: string;
}

/**
 * Невидимый компонент, который поллит /api/jobs/:jobId/status и пишет результат в SessionsContext.
 * Один экземпляр на каждую активную сессию с jobId.
 * Останавливается автоматически когда job переходит в completed/failed.
 */
export function SessionPoller({ sessionId, jobId }: SessionPollerProps) {
  const { setJobState, updateSession } = useSessions();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    const stop = () => {
      stoppedRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const poll = async () => {
      if (stoppedRef.current) return;
      try {
        const res = await fetch(`/api/jobs/${jobId}/status`);
        if (!res.ok) {
          if (res.status === 404) {
            // Job не найден — больше не поллим
            stop();
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        const data = json.data as JobStateSnapshot;
        if (stoppedRef.current) return;

        setJobState(sessionId, data);

        // Синхронизируем serverStatus сессии с реальным
        if (data.status === 'awaiting_confirmation') {
          updateSession(sessionId, { serverStatus: 'awaiting_confirmation' });
        } else if (data.status === 'processing') {
          updateSession(sessionId, { serverStatus: 'generating' });
        } else if (data.status === 'completed') {
          updateSession(sessionId, { serverStatus: 'completed' });
        } else if (data.status === 'failed') {
          updateSession(sessionId, { serverStatus: 'failed' });
        }

        if (TERMINAL.has(data.status)) {
          stop();
        }
      } catch (err) {
        console.warn(`[SessionPoller ${sessionId}] poll error:`, err);
      }
    };

    // Первый запуск сразу, потом по интервалу
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return stop;
  }, [sessionId, jobId, setJobState, updateSession]);

  return null;
}

/**
 * Контейнер, который рендерит SessionPoller для каждой активной сессии с jobId.
 * Размещается один раз в дереве компонентов внутри SessionsProvider.
 */
export function ActiveSessionPollers() {
  const { state } = useSessions();

  const pollers: Array<{ sessionId: string; jobId: string }> = [];
  for (const session of Object.values(state.sessions)) {
    if (!session.jobId) continue;
    // Не поллим завершённые и failed
    if (session.serverStatus === 'completed' || session.serverStatus === 'failed') continue;
    pollers.push({ sessionId: session.sessionId, jobId: session.jobId });
  }

  return (
    <>
      {pollers.map(p => (
        <SessionPoller key={`${p.sessionId}-${p.jobId}`} sessionId={p.sessionId} jobId={p.jobId} />
      ))}
    </>
  );
}
