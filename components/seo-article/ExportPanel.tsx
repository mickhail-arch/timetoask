'use client';
import { useState, useCallback } from 'react';
import { stripBase64Images } from '@/lib/seo-article/export';

function transformForTilda(html: string): string {
  let s = html;
  s = s.replace(/\s+style="[^"]*"/gi, '');
  s = s.replace(/<\/(div|blockquote|cite|figcaption|figure|article|section|nav)>/gi, '</$1> ');
  s = s.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');
  s = s.replace(/ {2,}/g, ' ');
  return s;
}

function transformForDzen(html: string): string {
  let result = html;
  result = result.replace(/\s+style="[^"]*"/gi, '');
  result = result.replace(/<\/(div|blockquote|cite|figcaption|figure|article|section|nav|header|footer)>/gi, '</$1> ');
  result = result.replace(/<(blockquote|cite|figcaption)[^>]*>/gi, '\n<$1>');
  result = result.replace(/<cite[^>]*>([\s\S]*?)<\/cite>/gi, '\n<p><em>$1</em></p>');
  result = result.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1');
  result = result.replace(/<nav[^>]*>([\s\S]*?)<\/nav>/gi, '$1');
  result = result.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, '$1');
  result = result.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, '$1');
  result = result.replace(/<article[^>]*>([\s\S]*?)<\/article>/gi, '$1');
  result = result.replace(/<br\s*\/?>/gi, '<br>\n');
  result = result.replace(/<\/(p|h1|h2|h3|blockquote|ul|ol)>/gi, '</$1>\n\n');
  result = result.replace(/<\/li>/gi, '</li>\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/ {2,}/g, ' ');
  result = result.trim();
  return result;
}

export function CopyButton({ text, label = 'Копировать' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button onClick={handleCopy}
      className={`ml-2 shrink-0 rounded-[var(--radius-sm)] border px-2.5 py-0.5 text-[11px] transition-all ${
        copied ? 'border-[var(--color-step-done)] bg-[var(--color-step-done)] text-white' : 'border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] text-[var(--color-text-secondary)] hover:bg-[#F5F5F5] hover:text-[var(--color-text-primary)]'
      }`}>{copied ? 'Готово' : label}</button>
  );
}

interface ExportPanelProps {
  onCopyArticle: () => void;
  onDownloadHtml: () => void;
  onDownloadDocx: () => void;
  onDownloadMetadata: () => void;
  onNewArticle: () => void;
  onRegenerate?: () => void;
  articleHtml?: string;
}

export function ExportPanel({ onCopyArticle, onDownloadHtml, onDownloadDocx, onDownloadMetadata, onNewArticle, onRegenerate, articleHtml }: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copiedDzen, setCopiedDzen] = useState(false);

  const copyHtmlToClipboard = useCallback(async (html: string) => {
    const clean = stripBase64Images(html);
    const plain = clean.replace(/<[^>]*>/g, '');
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([clean], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ]);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!articleHtml) { onCopyArticle(); setCopied(true); setTimeout(() => setCopied(false), 2000); return; }
    try { await copyHtmlToClipboard(articleHtml); } catch { onCopyArticle(); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [articleHtml, onCopyArticle, copyHtmlToClipboard]);

  const handleCopyDzen = useCallback(async () => {
    if (!articleHtml) return;
    const stripped = stripBase64Images(articleHtml);
    const simplified = transformForDzen(stripped);
    const plainText = simplified.replace(/<[^>]*>/g, '');
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([simplified], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(plainText);
    }
    setCopiedDzen(true);
    setTimeout(() => setCopiedDzen(false), 2000);
  }, [articleHtml]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Экспорт статьи</div>
      <div className="space-y-1.5">
        <button onClick={handleCopy} className={`w-full rounded-[var(--radius-md)] py-2.5 text-[13px] font-medium transition-all ${
          copied
            ? 'bg-[var(--color-step-done)] text-white'
            : 'bg-[var(--seo-selected-bg)] text-[var(--seo-selected-text)] hover:opacity-90'
        }`}>
          {copied ? '✓ Скопировано' : 'Скопировать статью'}
        </button>
        <div className="flex gap-1.5">
          <button onClick={onDownloadHtml} className="flex-1 rounded-[var(--radius-md)] border border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] py-2.5 text-[13px] transition-colors hover:bg-[#F5F5F5]">↓ Скачать .html</button>
          <button onClick={onDownloadDocx} className="flex-1 rounded-[var(--radius-md)] border border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] py-2.5 text-[13px] transition-colors hover:bg-[#F5F5F5]">↓ Скачать .docx</button>
        </div>
        {articleHtml && (
          <button onClick={handleCopyDzen} className={`w-full rounded-[var(--radius-md)] border py-2.5 text-[13px] transition-all ${
            copiedDzen
              ? 'border-[var(--color-step-done)] bg-[var(--color-step-done)] text-white'
              : 'border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] transition-colors hover:bg-[#F5F5F5]'
          }`}>
            {copiedDzen ? '✓ Скопировано для Дзен' : 'Копировать для Дзен'}
          </button>
        )}
        <button onClick={onDownloadMetadata} className="w-full rounded-[var(--radius-md)] border border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] py-2.5 text-[13px] transition-colors hover:bg-[#F5F5F5]">↓ Метаданные .docx</button>
      </div>
      <div className="mt-2 text-center text-[11px] text-[var(--color-step-pending)]">Форматирование сохраняется в WordPress, Tilda, Notion, Google Docs</div>
      {onRegenerate && (
        <button onClick={onRegenerate}
          className="mt-3 w-full rounded-[var(--radius-md)] border border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] py-2.5 text-[13px] text-[var(--color-text-primary)] transition-colors hover:bg-[#F5F5F5]">
          Перегенерировать текст
        </button>
      )}
      <button onClick={onNewArticle}
        className="mt-3 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] py-2.5 text-[13px] text-black transition-colors hover:brightness-90">
        Создать новую статью
      </button>
    </div>
  );
}
