import { notFound } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { ToolWorkspace } from '@/components/app/tool-workspace';

interface Manifest {
  output_format?: string;
}

async function getTool(id: string) {
  const tool = await prisma.tool.findUnique({ where: { id } });
  if (!tool || tool.status === 'disabled') return null;

  let outputFormat = 'json';
  try {
    const manifestPath = join(process.cwd(), 'plugins', tool.slug, 'manifest.json');
    const raw = await readFile(manifestPath, 'utf-8');
    const manifest: Manifest = JSON.parse(raw);
    outputFormat = manifest.output_format ?? 'json';
  } catch {
    // manifest may not exist
  }

  return { ...tool, outputFormat };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tool = await getTool(id);
  if (!tool) notFound();

  const costBadge = (
    <Badge variant="secondary" className="text-xs">
      {tool.tokenCost} тк
    </Badge>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={tool.name}
        subtitle={tool.description ?? undefined}
        badge={costBadge}
      />
      <ToolWorkspace
        plugin={{
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
          executionMode: tool.executionMode as 'sync' | 'async',
          tokenCost: tool.tokenCost,
          freeUsesLimit: tool.freeUsesLimit,
          outputFormat: tool.outputFormat,
        }}
      />
    </div>
  );
}
