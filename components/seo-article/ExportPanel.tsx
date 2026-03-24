'use client';
import { useState, useCallback } from 'react';

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
}

export function ExportPanel({ onCopyArticle, onDownloadHtml, onDownloadDocx, onDownloadMetadata, onNewArticle, onRegenerate }: ExportPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    onCopyArticle();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopyArticle]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Экспорт статьи</div>
      <div className="space-y-1.5">
        <button onClick={handleCopy} className={`w-full rounded-[var(--radius-md)] py-2.5 text-[13px] font-medium transition-all ${
          copied
            ? 'bg-[var(--color-step-done)] text-white'
            : 'bg-[var(--seo-selected-bg)] text-[var(--seo-selected-text)] hover:opacity-90'
        }`}>
          {copied ? '✓ Текст скопирован' : 'Скопировать статью'}
        </button>
        <div className="flex gap-1.5">
          <button onClick={onDownloadHtml} className="flex-1 rounded-[var(--radius-md)] border border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] py-2.5 text-[13px] transition-colors hover:bg-[#F5F5F5]">↓ Скачать .html</button>
          <button onClick={onDownloadDocx} className="flex-1 rounded-[var(--radius-md)] border border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] py-2.5 text-[13px] transition-colors hover:bg-[#F5F5F5]">↓ Скачать .docx</button>
        </div>
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
