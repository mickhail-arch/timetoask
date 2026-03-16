'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTools } from '@/hooks/useTools';
import { ToolCard } from '@/components/app/tool-card';

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-surface p-5">
      <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
      <div className="flex flex-col gap-2">
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

export function ToolsGrid() {
  const { tools, isLoading, error } = useTools();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle size={40} className="text-error" />
        <p className="text-sm text-text-secondary">
          Не удалось загрузить инструменты
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-muted"
        >
          <RefreshCw size={16} />
          Повторить
        </button>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-lg font-medium text-text-primary">
          Инструменты появятся совсем скоро
        </p>
        <p className="text-sm text-text-secondary">
          Мы готовим для вас полезные AI-инструменты
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
