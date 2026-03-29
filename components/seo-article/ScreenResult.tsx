'use client';
import { useState } from 'react';
import { QualityPanel } from './QualityPanel';
import { MetaPanel } from './MetaPanel';
import { MetadataPanel } from './MetadataPanel';
import { ExportPanel } from './ExportPanel';
import '@/components/seo-article/tokens.css';

interface ArticleResult {
  article_html: string;
  metadata: { title: string; description: string; slug: string; breadcrumb: string; alt_texts: string[]; json_ld: string; };
  quality_metrics: Record<string, number>;
  warnings?: string[];
}

interface ScreenResultProps {
  result: ArticleResult;
  query: string;
  stepCount: number;
  duration: number;
  onCopyArticle: () => void;
  onDownloadHtml: () => void;
  onDownloadDocx: () => void;
  onDownloadMetadata: () => void;
  onNewArticle: () => void;
  onRegenerate?: () => void;
}

export function ScreenResult({ result, query, stepCount, duration, onCopyArticle, onDownloadHtml, onDownloadDocx, onDownloadMetadata, onNewArticle, onRegenerate }: ScreenResultProps) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const m = result.quality_metrics;

  return (
    <div className="mx-auto max-w-[680px] space-y-3">
      <div className="text-[13px] text-[var(--color-text-secondary)]">
        <strong className="font-medium text-[var(--color-text-primary)]">{query}</strong> · {stepCount} шагов · ~{duration} сек
      </div>

      {result.warnings && result.warnings.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-warn-border)] bg-[var(--color-warn-bg)] px-4 py-2.5 text-xs text-[var(--color-warn-text)]">
          {result.warnings.join('. ')}
        </div>
      )}

      <QualityPanel metrics={m as any} />

      <MetaPanel title={result.metadata.title} titleLength={result.metadata.title.length} description={result.metadata.description} descriptionLength={result.metadata.description.length} />

      {/* Статья */}
      <div>
        <div className="flex overflow-hidden rounded-t-[var(--radius-md)] border border-b-0 border-[var(--seo-card-border)]">
          <button onClick={() => setTab('preview')} className={`flex-1 py-2 text-[13px] transition-all ${tab === 'preview' ? 'bg-white font-medium text-[var(--color-text-primary)]' : 'bg-[#F5F5F5] text-[var(--color-text-secondary)]'}`}>Превью</button>
          <button onClick={() => setTab('code')} className={`flex-1 py-2 text-[13px] transition-all ${tab === 'code' ? 'bg-white font-medium text-[var(--color-text-primary)]' : 'bg-[#F5F5F5] text-[var(--color-text-secondary)]'}`}>HTML-код</button>
        </div>
        {tab === 'preview' ? (
          <div className="seo-preview min-h-[360px] overflow-y-auto rounded-b-[var(--radius-md)] border border-[var(--seo-card-border)] bg-white p-5 text-sm leading-relaxed" style={{ resize: 'vertical' }} dangerouslySetInnerHTML={{ __html: `<style>.seo-preview a[href]{position:relative;cursor:pointer}.seo-preview a[href]:hover::before{content:attr(href);position:absolute;bottom:100%;left:0;background:#fff;border:1px solid #E0E0E0;border-radius:6px;padding:4px 8px;font-size:11px;color:#666;white-space:nowrap;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.08);pointer-events:none}</style>${result.article_html}` }} />
        ) : (
          <pre className="min-h-[360px] overflow-y-auto rounded-b-[var(--radius-md)] border border-[var(--seo-card-border)] bg-[#FAFAFA] p-4 font-mono text-xs leading-relaxed text-[#444] whitespace-pre-wrap break-all" style={{ resize: 'vertical' }}>
            {result.article_html}
          </pre>
        )}
      </div>

      <MetadataPanel pageName={query} slug={result.metadata.slug} breadcrumb={result.metadata.breadcrumb} altTexts={result.metadata.alt_texts} jsonLd={result.metadata.json_ld} />

      <ExportPanel articleHtml={result.article_html} onCopyArticle={onCopyArticle} onDownloadHtml={onDownloadHtml} onDownloadDocx={onDownloadDocx} onDownloadMetadata={onDownloadMetadata} onNewArticle={onNewArticle} onRegenerate={onRegenerate} />

      <div className="text-center text-[11px] text-[var(--color-step-pending)]">Сгенерировано за {duration} сек · {stepCount} шагов</div>
    </div>
  );
}
