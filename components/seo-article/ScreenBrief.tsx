'use client';

import { useState, useCallback } from 'react';
import { BriefHeadings } from './BriefHeadings';
import type { HeadingItem } from './BriefHeadings';
import '@/components/seo-article/tokens.css';

interface BriefData {
  h1: string;
  h2_list: Array<{ text: string; h3s: string[] }>;
  subtopics?: string[];
  lsi_keywords?: string[];
}

interface ScreenBriefProps {
  brief: BriefData;
  charCount: number;
  imageCount: number;
  faqCount: number;
  calculatedPrice: number;
  onConfirm: (updatedBrief: BriefData, userEdited: boolean) => void;
  onBack: () => void;
}

export function ScreenBrief({
  brief,
  charCount,
  imageCount,
  faqCount,
  calculatedPrice,
  onConfirm,
  onBack,
}: ScreenBriefProps) {
  const [h1, setH1] = useState(brief.h1);
  const [h2List, setH2List] = useState<HeadingItem[]>(() =>
    brief.h2_list.map((h2, i) => ({
      id: `h2-${i}`,
      text: h2.text,
      h3s: h2.h3s.map((h3, j) => ({ id: `h3-${i}-${j}`, text: h3 })),
    }))
  );
  const [edited, setEdited] = useState(false);

  const handleH1Change = useCallback((text: string) => {
    setH1(text);
    setEdited(true);
  }, []);

  const handleH2Change = useCallback((list: HeadingItem[]) => {
    setH2List(list);
    setEdited(true);
  }, []);

  const handleConfirm = useCallback(() => {
    const updatedBrief: BriefData = {
      ...brief,
      h1,
      h2_list: h2List.map(h2 => ({
        text: h2.text,
        h3s: h2.h3s.map(h3 => h3.text),
      })),
    };
    onConfirm(updatedBrief, edited);
  }, [brief, h1, h2List, edited, onConfirm]);

  const h2Count = h2List.length;
  const h3Count = h2List.reduce((sum, h2) => sum + h2.h3s.length, 0);

  return (
    <div className="mx-auto max-w-[600px]">
      {/* Заголовок + мини-прогресс */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          Экран 3 — Структура статьи
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-step-done)]" />
          <span className="inline-block h-px w-4 bg-[var(--seo-card-border)]" />
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-step-running)]" />
          <span className="inline-block h-px w-4 bg-[var(--seo-card-border)]" />
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-step-pending)]" />
          <span className="ml-1">Анализ · ТЗ · Статья</span>
        </div>
      </div>

      <div className="mb-1 text-xl font-medium text-[var(--color-text-primary)]">
        Структура готова — проверьте перед генерацией
      </div>
      <div className="mb-5 text-sm text-[var(--color-text-secondary)]">
        «{brief.h1}» · {charCount.toLocaleString('ru-RU')} символов · {imageCount} картинок
      </div>

      {/* Инфо-чипы */}
      <div className="mb-5 flex flex-wrap gap-2">
        <span className="rounded-[var(--radius-sm)] bg-[#F5F5F5] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
          <strong className="font-medium text-[var(--color-text-primary)]">{h2Count}</strong> разделов H2
        </span>
        <span className="rounded-[var(--radius-sm)] bg-[#F5F5F5] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
          <strong className="font-medium text-[var(--color-text-primary)]">{h3Count}</strong> подразделов H3
        </span>
        <span className="rounded-[var(--radius-sm)] bg-[#F5F5F5] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
          <strong className="font-medium text-[var(--color-text-primary)]">{faqCount}</strong> FAQ
        </span>
        <span className="rounded-[var(--radius-sm)] bg-[#F5F5F5] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
          <strong className="font-medium text-[var(--color-text-primary)]">{calculatedPrice}</strong> токенов
        </span>
      </div>

      {/* Заголовки */}
      <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
          <span>Структура заголовков</span>
          <span className="font-normal text-[var(--color-step-pending)]">перетаскивайте для изменения порядка</span>
        </div>
        <BriefHeadings h1={h1} h2List={h2List} onH1Change={handleH1Change} onChange={handleH2Change} />
      </div>

      {/* Футер */}
      <div className="flex items-center justify-between border-t border-[var(--seo-card-border)] pt-4">
        <button onClick={onBack}
          className="rounded-[var(--radius-md)] border border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] px-5 py-2 text-[13px] text-[var(--color-text-primary)] transition-colors hover:bg-[#F5F5F5]">
          ← Назад к параметрам
        </button>
        <button onClick={handleConfirm}
          className="rounded-[var(--radius-md)] bg-[var(--seo-btn-primary-bg)] px-6 py-2.5 text-sm font-medium text-[var(--seo-btn-primary-text)] transition-colors hover:brightness-95">
          Продолжить →
        </button>
      </div>
    </div>
  );
}
