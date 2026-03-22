'use client';
import { CopyButton } from './ExportPanel';

interface MetadataPanelProps {
  pageName: string; slug: string; breadcrumb: string;
  altTexts: string[]; jsonLd: string;
}

export function MetadataPanel({ pageName, slug, breadcrumb, altTexts, jsonLd }: MetadataPanelProps) {
  const allAlts = altTexts.map((a, i) => `${i + 1}. ${a}`).join('\n');
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Метаданные для вставки</div>
      <Row label="Страница" value={pageName} />
      <Row label="ЧПУ / Slug" value={slug} />
      <Row label="Хлебные крошки" value={breadcrumb} />
      {altTexts.length > 0 && (
        <div className="border-t border-[#F0F0F0] py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-secondary)]">Изображения ({altTexts.length} шт)</span>
            <CopyButton text={allAlts} label="Все alt-тексты" />
          </div>
          {altTexts.map((alt, i) => (
            <div key={i} className="flex items-center justify-between border-b border-[#F5F5F5] py-1.5 last:border-0">
              <span className="mr-1.5 text-xs text-[var(--color-text-secondary)]">{i + 1}</span>
              <span className="flex-1 text-xs">{alt}</span>
              <CopyButton text={alt} />
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-[#F0F0F0] pt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] text-[var(--color-text-secondary)]">JSON-LD Schema</span>
          <CopyButton text={jsonLd} />
        </div>
        <div className="max-h-20 overflow-y-auto rounded-[var(--radius-sm)] border border-[#F0F0F0] bg-[#FAFAFA] px-2.5 py-2 font-mono text-[11px] text-[#444] break-words whitespace-pre-wrap">{jsonLd}</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between border-b border-[#F0F0F0] py-2">
      <div className="flex-1"><div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div><div className="text-[13px] break-words">{value}</div></div>
      <CopyButton text={value} />
    </div>
  );
}
