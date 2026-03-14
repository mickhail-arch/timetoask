'use client';

import { useState, useEffect } from 'react';

export interface Tool {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  model: string;
  status: string;
  executionMode: string;
  tokenCost: number;
  freeUsesLimit: number;
  version: number;
}

interface UseToolsResult {
  tools: Tool[];
  isLoading: boolean;
  error: string | null;
}

export function useTools(): UseToolsResult {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTools() {
      try {
        const res = await fetch('/api/tools');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setTools(json.data ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch tools');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchTools();
    return () => { cancelled = true; };
  }, []);

  return { tools, isLoading, error };
}
