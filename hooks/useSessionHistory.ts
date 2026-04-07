//hooks/useSessionHistory.ts

'use client';

import { useState, useEffect, useCallback } from 'react';

interface SessionSummary {
  id: string;
  title: string;
  status: string;
  version: number;
  parentId: string | null;
  tokensUsed: number;
  durationSec: number;
  outputMeta: Record<string, unknown> | null;
  createdAt: string;
}

interface SessionFull {
  id: string;
  title: string;
  status: string;
  version: number;
  parentId: string | null;
  inputParams: Record<string, unknown>;
  outputMeta: Record<string, unknown> | null;
  contentText: string | null;
  tokensUsed: number;
  durationSec: number;
  createdAt: string;
}

export function useSessionHistory(toolSlug: string) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions?toolSlug=${toolSlug}&limit=50`);
      if (res.ok) {
        const json = await res.json();
        setSessions(json.data ?? []);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [toolSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadSession = useCallback(async (sessionId: string): Promise<SessionFull | null> => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const json = await res.json();
        return json.data ?? null;
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
    return null;
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, []);

  return { sessions, loading, refresh, loadSession, deleteSession };
}

export type { SessionSummary, SessionFull };
