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

const FAQ_RE = /faq|часто задаваемые|вопрос/i;

let faqNextId = 500;
const genFaqId = () => `faq-${faqNextId++}`;

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

  const [faqQuestions, setFaqQuestions] = useState<Array<{ id: string; text: string }>>(() => {
    if (faqCount === 0) return [];
    const faqIdx = brief.h2_list.findIndex(h2 => FAQ_RE.test(h2.text));
    if (faqIdx === -1) return [];
    return brief.h2_list[faqIdx].h3s.map((q, i) => ({ id: `faq-${i}`, text: q }));
  });

  const [h2List, setH2List] = useState<HeadingItem[]>(() =>
    brief.h2_list
      .filter(h2 => !(faqCount > 0 && FAQ_RE.test(h2.text)))
      .map((h2, i) => ({
        id: `h2-${i}`,
        text: h2.text,
        h3s: h2.h3s.map((h3, j) => ({ id: `h3-${i}-${j}`, text: h3 })),
      }))
  );

  const [edited, setEdited] = useState(false);

  const [faqEditingId, setFaqEditingId] = useState<string | null>(null);
  const [faqDragIdx, setFaqDragIdx] = useState<number | null>(null);
  const [faqDragOverIdx, setFaqDragOverIdx] = useState<number | null>(null);

  const handleH1Change = useCallback((text: string) => {
    setH1(text);
    setEdited(true);
  }, []);

  const handleH2Change = useCallback((list: HeadingItem[]) => {
    setH2List(list);
    setEdited(true);
  }, []);

  const handleConfirm = useCallback(() => {
    const h2ListPlain = h2List.map(h2 => ({
      text: h2.text,
      h3s: h2.h3s.map(h3 => h3.text),
    }));

    if (faqCount > 0 && faqQuestions.length > 0) {
      h2ListPlain.push({
        text: 'Часто задаваемые вопросы',
        h3s: faqQuestions.map(q => q.text),
      });
    }

    const updatedBrief: BriefData = { ...brief, h1, h2_list: h2ListPlain };
    onConfirm(updatedBrief, edited);
  }, [brief, h1, h2List, faqQuestions, faqCount, edited, onConfirm]);

  const faqSaveEdit = useCallback((id: string, text: string) => {
    const val = text.trim() || 'Без названия';
    setFaqQuestions(prev => prev.map(q => (q.id === id ? { ...q, text: val } : q)));
    setFaqEditingId(null);
    setEdited(true);
  }, []);

  const faqDelete = useCallback((idx: number) => {
    setFaqQuestions(prev => prev.filter((_, i) => i !== idx));
    setEdited(true);
  }, []);

  const faqAddAfter = useCallback((idx: number) => {
    setFaqQuestions(prev => {
      if (prev.length >= faqCount) return prev;
      const id = genFaqId();
      const next = [...prev];
      next.splice(idx + 1, 0, { id, text: 'Новый вопрос' });
      setFaqEditingId(id);
      return next;
    });
    setEdited(true);
  }, [faqCount]);

  const faqAddBottom = useCallback(() => {
    setFaqQuestions(prev => {
      if (prev.length >= faqCount) return prev;
      const id = genFaqId();
      setFaqEditingId(id);
      return [...prev, { id, text: 'Новый вопрос' }];
    });
    setEdited(true);
  }, [faqCount]);

  const onFaqDragStart = (idx: number) => setFaqDragIdx(idx);
  const onFaqDragOver = (idx: number) => {
    if (faqDragIdx !== null && faqDragIdx !== idx) setFaqDragOverIdx(idx);
  };
  const onFaqDrop = (idx: number) => {
    if (faqDragIdx !== null && faqDragIdx !== idx) {
      setFaqQuestions(prev => {
        const items = [...prev];
        const [moved] = items.splice(faqDragIdx, 1);
        items.splice(idx, 0, moved);
        return items;
      });
      setEdited(true);
    }
    setFaqDragIdx(null);
    setFaqDragOverIdx(null);
  };
  const onFaqDragEnd = () => { setFaqDragIdx(null); setFaqDragOverIdx(null); };

  const renderFaqEditable = (id: string, text: string) => {
    if (faqEditingId === id) {
      return (
        <input
          autoFocus
          defaultValue={text}
          maxLength={200}
          onBlur={e => faqSaveEdit(id, e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') faqSaveEdit(id, (e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setFaqEditingId(null);
          }}
          className="min-w-0 flex-1 rounded border border-[var(--seo-input-focus)] px-1.5 py-0.5 text-[13px] outline-none"
        />
      );
    }
    return (
      <span className="min-w-0 flex-1 break-words text-[13px] text-[var(--color-text-primary)]" style={{ lineHeight: '1.2' }}>
        {text}
      </span>
    );
  };

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
          <strong className="font-medium text-[var(--color-text-primary)]">{faqQuestions.length}</strong> FAQ
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

      {/* FAQ блок */}
      {faqCount > 0 && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
            <span>FAQ-вопросы ({faqQuestions.length}/{faqCount})</span>
            <span className="font-normal text-[var(--color-step-pending)]">перетаскивайте для изменения порядка</span>
          </div>

          {faqQuestions.map((q, idx) => (
            <div
              key={q.id}
              draggable
              onDragStart={() => onFaqDragStart(idx)}
              onDragOver={e => { e.preventDefault(); onFaqDragOver(idx); }}
              onDrop={() => onFaqDrop(idx)}
              onDragEnd={onFaqDragEnd}
              className={`mb-1 flex items-center gap-1 rounded-[var(--radius-md)] border px-2.5 py-2 transition-all ${
                faqDragIdx === idx ? 'opacity-40' : ''
              } ${
                faqDragOverIdx === idx
                  ? 'border-[var(--color-step-running)] bg-[var(--color-brief-bg)]'
                  : 'border-[var(--seo-card-border)] bg-white'
              }`}
            >
              <span className="cursor-grab text-sm text-[var(--color-step-pending)] active:cursor-grabbing">⠿</span>
              <button
                onClick={() => faqAddAfter(idx)}
                disabled={faqQuestions.length >= faqCount}
                className="flex h-[24px] w-[24px] shrink-0 items-center justify-center text-sm text-[var(--color-step-pending)] hover:text-[var(--color-step-running)] disabled:opacity-30 disabled:hover:text-[var(--color-step-pending)]"
              >+</button>
              <span className="shrink-0 rounded bg-[#FFF3E0] px-1.5 py-0.5 text-[10px] font-medium text-[#E65100]">FAQ</span>
              {renderFaqEditable(q.id, q.text)}
              <button onClick={() => setFaqEditingId(q.id)} className="shrink-0 text-sm text-[var(--color-step-pending)] hover:text-[var(--color-text-primary)]">✏</button>
              <button onClick={() => faqDelete(idx)} className="shrink-0 text-sm text-[var(--color-step-pending)] hover:text-[var(--color-step-error)]">×</button>
            </div>
          ))}

          <button
            onClick={faqAddBottom}
            disabled={faqQuestions.length >= faqCount}
            className="mt-2 w-full rounded-[var(--radius-md)] border border-dashed border-[var(--seo-card-border)] py-1.5 text-xs text-[var(--color-step-pending)] transition-colors hover:border-[var(--color-step-running)] hover:text-[var(--color-step-running)] disabled:opacity-30 disabled:hover:border-[var(--seo-card-border)] disabled:hover:text-[var(--color-step-pending)]"
          >
            + Добавить вопрос
          </button>
        </div>
      )}

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
