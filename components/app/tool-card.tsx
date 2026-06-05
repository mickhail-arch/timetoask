import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tool } from '@/hooks/useTools';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Активен',
    className: 'border-transparent bg-[var(--color-accent)]/15 text-[var(--color-accent)]',
  },
  beta: {
    label: 'Бета',
    className: 'border-transparent bg-amber-500/15 text-amber-500',
  },
  soon: {
    label: 'Скоро',
    className: 'border-transparent bg-muted text-muted-foreground',
  },
};

const SLUG_TO_URL: Record<string, string> = {
  'seo-article-express': 'seo-article',
};

const SLUG_TO_NAME: Record<string, string> = {
  'seo-article-express': 'SEO-статья',
};

function getToolUrl(slug: string): string {
  return `/tools/${SLUG_TO_URL[slug] ?? slug}`;
}

function getToolName(slug: string, name: string): string {
  return SLUG_TO_NAME[slug] ?? name;
}

function CostBadge({ tokenCost, freeUsesLimit }: Pick<Tool, 'tokenCost' | 'freeUsesLimit'>) {
  if (freeUsesLimit > 0) {
    return (
      <Badge className="border-transparent bg-[var(--color-accent)]/15 text-foreground">
        Бесплатно (осталось {freeUsesLimit})
      </Badge>
    );
  }
  return <Badge variant="secondary">{tokenCost} тк</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return null;
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  return <Badge className={config.className}>{config.label}</Badge>;
}

export function ToolCard({ tool }: { tool: Tool }) {
  const isSoon = tool.status === 'soon';
  const displayName = getToolName(tool.slug ?? tool.id, tool.name);

  return (
    <Link
      href={getToolUrl(tool.slug ?? tool.id)}
      aria-disabled={isSoon}
      tabIndex={isSoon ? -1 : undefined}
      className={cn(
        'block transition-all',
        isSoon ? 'pointer-events-none opacity-50' : 'cursor-pointer',
      )}
    >
      <Card className="flex flex-col gap-4 border-transparent p-5 transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
            <Wrench className="size-5 text-[var(--color-accent)]" />
          </div>
          <StatusBadge status={tool.status} />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold text-foreground">
            {displayName}
          </span>
          {tool.description && (
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {tool.description}
            </span>
          )}
        </div>

        <div className="mt-auto">
          <CostBadge tokenCost={tool.tokenCost} freeUsesLimit={tool.freeUsesLimit} />
        </div>
      </Card>
    </Link>
  );
}
