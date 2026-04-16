'use client';
import { useState, useMemo } from 'react';
import { QualityPanel } from './QualityPanel';
import { MetaPanel } from './MetaPanel';
import { MetadataPanel } from './MetadataPanel';
import { ExportPanel } from './ExportPanel';
import { ArticleEditor } from './ArticleEditor';
import '@/components/seo-article/tokens.css';

interface ArticleResult {
  article_html: string;
  metadata: { title: string; description: string; slug: string; breadcrumb: string; alt_texts: string[]; json_ld: string; };
  quality_metrics: Record<string, number>;
  warnings?: string[];
  images_map?: Record<string, { base64?: string; url?: string }>;
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
  sessionId?: string | null;
  onSave?: (data: { articleHtml: string; metadata: ArticleResult['metadata'] }) => Promise<void>;
}

export function ScreenResult({ result, query, stepCount, duration, onCopyArticle, onDownloadHtml, onDownloadDocx, onDownloadMetadata, onNewArticle, onRegenerate, sessionId, onSave }: ScreenResultProps) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [editedHtml, setEditedHtml] = useState(result.article_html);
  const [editedTitle, setEditedTitle] = useState(result.metadata.title);
  const [editedDescription, setEditedDescription] = useState(result.metadata.description);
  const [editedSlug, setEditedSlug] = useState(result.metadata.slug);
  const [editedBreadcrumb, setEditedBreadcrumb] = useState(result.metadata.breadcrumb);
  const [editedPageName, setEditedPageName] = useState(query);
  const [editedAltTexts, setEditedAltTexts] = useState(result.metadata.alt_texts);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const m = result.quality_metrics;

  const renderedHtml = useMemo(() => {
    let html = editedHtml;
    const map = result.images_map ?? {};
    for (const [imageId, imgData] of Object.entries(map)) {
      const src = imgData.base64
        ? `data:image/png;base64,${imgData.base64}`
        : imgData.url ?? '';
      html = html.replace(
        new RegExp(`src="/api/images/${imageId}"`, 'g'),
        `src="${src}"`,
      );
    }
    return html;
  }, [editedHtml, result.images_map]);

  const codeHtml = useMemo(() => {
    let html = editedHtml;
    const map = result.images_map ?? {};
    for (const [imageId, imgData] of Object.entries(map)) {
      const src = imgData.url ?? '[base64 image]';
      html = html.replace(
        new RegExp(`src="/api/images/${imageId}"`, 'g'),
        `src="${src}"`,
      );
    }
    return html;
  }, [editedHtml, result.images_map]);

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

      <MetadataPanel
        pageName={editedPageName}
        slug={editedSlug}
        breadcrumb={editedBreadcrumb}
        altTexts={editedAltTexts}
        jsonLd={result.metadata.json_ld}
        editable={true}
        onChangePageName={(v) => { setEditedPageName(v); setIsDirty(true); }}
        onChangeSlug={(v) => { setEditedSlug(v); setIsDirty(true); }}
        onChangeBreadcrumb={(v) => { setEditedBreadcrumb(v); setIsDirty(true); }}
        onChangeAltText={(i, v) => { setEditedAltTexts(prev => { const next = [...prev]; next[i] = v; return next; }); setIsDirty(true); }}
      />

      <MetaPanel
        title={editedTitle}
        titleLength={editedTitle.length}
        description={editedDescription}
        descriptionLength={editedDescription.length}
        editable={true}
        onChangeTitle={(v) => { setEditedTitle(v); setIsDirty(true); }}
        onChangeDescription={(v) => { setEditedDescription(v); setIsDirty(true); }}
      />

      {/* Статья */}
      <div>
        <div className="flex overflow-hidden rounded-t-[var(--radius-md)] border border-b-0 border-[var(--seo-card-border)]">
          <button onClick={() => setTab('preview')} className={`flex-1 py-2 text-[13px] transition-all ${tab === 'preview' ? 'bg-white font-medium text-[var(--color-text-primary)]' : 'bg-[#F5F5F5] text-[var(--color-text-secondary)]'}`}>Превью</button>
          <button onClick={() => setTab('code')} className={`flex-1 py-2 text-[13px] transition-all ${tab === 'code' ? 'bg-white font-medium text-[var(--color-text-primary)]' : 'bg-[#F5F5F5] text-[var(--color-text-secondary)]'}`}>HTML-код</button>
        </div>
        {tab === 'preview' ? (
          <ArticleEditor
            html={renderedHtml}
            onChange={(html) => { setEditedHtml(html); setIsDirty(true); }}
            className="seo-preview min-h-[360px] overflow-y-auto rounded-b-[var(--radius-md)] border border-[var(--seo-card-border)] bg-white p-5 text-sm leading-relaxed"
          />
        ) : (
          <pre className="min-h-[360px] overflow-y-auto rounded-b-[var(--radius-md)] border border-[var(--seo-card-border)] bg-[#FAFAFA] p-4 font-mono text-xs leading-relaxed text-[#444] whitespace-pre-wrap break-all" style={{ resize: 'vertical' }}>
            {codeHtml}
          </pre>
        )}
      </div>

      {isDirty && onSave && (
        <button
          onClick={async () => {
            setSaving(true);
            await onSave({
              articleHtml: editedHtml,
              metadata: { ...result.metadata, title: editedTitle, description: editedDescription, slug: editedSlug, breadcrumb: editedBreadcrumb, alt_texts: editedAltTexts },
            });
            setIsDirty(false);
            setSaving(false);
          }}
          disabled={saving}
          className="w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      )}

      <ExportPanel articleHtml={result.article_html} onCopyArticle={onCopyArticle} onDownloadHtml={onDownloadHtml} onDownloadDocx={onDownloadDocx} onDownloadMetadata={onDownloadMetadata} onNewArticle={onNewArticle} onRegenerate={onRegenerate} />

      <div className="text-center text-[11px] text-[var(--color-step-pending)]">Сгенерировано за {duration} сек · {stepCount} шагов</div>
    </div>
  );
}
