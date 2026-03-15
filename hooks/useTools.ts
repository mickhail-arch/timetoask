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

const CACHE_TTL_MS = 5 * 60 * 1000;

let toolsCache: { data: Tool[]; timestamp: number } | null = null;

export function useTools(): UseToolsResult {
  const [tools, setTools] = useState<Tool[]>(toolsCache?.data ?? []);
  const [isLoading, setIsLoading] = useState(!toolsCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (toolsCache && Date.now() - toolsCache.timestamp < CACHE_TTL_MS) {
      setTools(toolsCache.data);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchTools() {
      try {
        const res = await fetch('/api/tools');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data: Tool[] = json.data ?? [];
        toolsCache = { data, timestamp: Date.now() };
        if (!cancelled) {
          setTools(data);
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
