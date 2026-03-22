'use client';
import { CopyButton } from './ExportPanel';

interface MetaPanelProps { title: string; titleLength: number; description: string; descriptionLength: number; }

export function MetaPanel({ title, titleLength, description, descriptionLength }: MetaPanelProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Мета-теги</div>
      <div className="flex items-start justify-between border-b border-[#F0F0F0] pb-2.5 mb-2.5">
        <div className="flex-1"><div className="text-[11px] text-[var(--color-text-secondary)]">Title ({titleLength} симв)</div><div className="text-[13px] break-words">{title}</div></div>
        <CopyButton text={title} />
      </div>
      <div className="flex items-start justify-between">
        <div className="flex-1"><div className="text-[11px] text-[var(--color-text-secondary)]">Description ({descriptionLength} симв)</div><div className="text-[13px] break-words">{description}</div></div>
        <CopyButton text={description} />
      </div>
    </div>
  );
}
