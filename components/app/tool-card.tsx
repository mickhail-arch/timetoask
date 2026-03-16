import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tool } from '@/hooks/useTools';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Активен',
    className: 'border-transparent bg-success/15 text-success',
  },
  beta: {
    label: 'Бета',
    className: 'border-transparent bg-amber-100 text-amber-700',
  },
  soon: {
    label: 'Скоро',
    className: 'border-transparent bg-muted text-muted-foreground',
  },
};

function CostBadge({ tokenCost, freeUsesLimit }: Pick<Tool, 'tokenCost' | 'freeUsesLimit'>) {
  if (freeUsesLimit > 0) {
    return (
      <Badge className="border-transparent bg-accent/15 text-accent-foreground">
        Бесплатно (осталось {freeUsesLimit})
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      {tokenCost} тк
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return <Badge className={config.className}>{config.label}</Badge>;
}

export function ToolCard({ tool }: { tool: Tool }) {
  const isSoon = tool.status === 'soon';

  return (
    <Link
      href={`/tools/${tool.id}`}
      aria-disabled={isSoon}
      tabIndex={isSoon ? -1 : undefined}
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-bg-surface p-5 transition-shadow',
        isSoon
          ? 'pointer-events-none opacity-50'
          : 'cursor-pointer hover:shadow-sm',
      )}
    >
      <div className="flex items-start justify-between">
        <Wrench size={32} className="shrink-0 text-accent" />
        <StatusBadge status={tool.status} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-lg font-bold text-text-primary">{tool.name}</span>
        <span className="line-clamp-2 text-sm text-text-secondary">
          {tool.description}
        </span>
      </div>

      <CostBadge tokenCost={tool.tokenCost} freeUsesLimit={tool.freeUsesLimit} />
    </Link>
  );
}
