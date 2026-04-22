'use client';

import { useState, useCallback } from 'react';
import { BriefHeadings } from './BriefHeadings';
import type { HeadingItem } from './BriefHeadings';
import '@/components/seo-article/tokens.css';

interface BriefData {
  h1: string;
  h2_list: Array<{
    text: string;
    h3s: string[];
    thesis?: string;
    facts?: string[];
    target_keywords?: string[];
  }>;
  subtopics?: string[];
  lsi_keywords?: string[];
  main_keyword?: string;
  table_topic?: string;
  case_topic?: string;
}

interface ScreenBriefProps {
  brief: BriefData;
  charCount: number;
  imageCount: number;
  faqCount: number;
  calculatedPrice: number;
  comparisonEnabled?: boolean;
  onConfirm: (updatedBrief: BriefData, userEdited: boolean) => void;
  onBack: () => void;
}

const FAQ_RE = /faq|часто задаваемые|вопрос/i;

let faqNextId = 500;
const genFaqId = () => `faq-${faqNextId++}`;

function getMaxFaqForCharCount(charCount: number): number {
  if (charCount <= 8000) return 3;
  if (charCount <= 10000) return 4;
  if (charCount <= 12000) return 5;
  if (charCount <= 14000) return 6;
  if (charCount <= 16000) return 7;
  if (charCount <= 18000) return 8;
  return 10;
}

function getStructureLimits(charCount: number) {
  if (charCount <= 6000) return { maxH2: 3, maxH3PerH2: 0, maxH3Total: 0 };
  if (charCount <= 7000) return { maxH2: 3, maxH3PerH2: 1, maxH3Total: 1 };
  if (charCount <= 8000) return { maxH2: 4, maxH3PerH2: 1, maxH3Total: 2 };
  if (charCount <= 9000) return { maxH2: 4, maxH3PerH2: 1, maxH3Total: 2 };
  if (charCount <= 10000) return { maxH2: 5, maxH3PerH2: 1, maxH3Total: 3 };
  if (charCount <= 11000) return { maxH2: 5, maxH3PerH2: 1, maxH3Total: 3 };
  if (charCount <= 12000) return { maxH2: 6, maxH3PerH2: 2, maxH3Total: 4 };
  if (charCount <= 13000) return { maxH2: 6, maxH3PerH2: 2, maxH3Total: 5 };
  if (charCount <= 14000) return { maxH2: 7, maxH3PerH2: 2, maxH3Total: 6 };
  if (charCount <= 15000) return { maxH2: 7, maxH3PerH2: 2, maxH3Total: 7 };
  if (charCount <= 16000) return { maxH2: 8, maxH3PerH2: 2, maxH3Total: 8 };
  if (charCount <= 17000) return { maxH2: 8, maxH3PerH2: 2, maxH3Total: 9 };
  if (charCount <= 18000) return { maxH2: 9, maxH3PerH2: 2, maxH3Total: 10 };
  if (charCount <= 19000) return { maxH2: 9, maxH3PerH2: 3, maxH3Total: 11 };
  return { maxH2: 10, maxH3PerH2: 3, maxH3Total: 12 };
}

export function ScreenBrief({
  brief,
  charCount,
  imageCount,
  faqCount,
  calculatedPrice,
  comparisonEnabled,
  onConfirm,
  onBack,
}: ScreenBriefProps) {
  const structureLimits = getStructureLimits(charCount);

  const [h1, setH1] = useState(brief.h1);

  const [faqQuestions, setFaqQuestions] = useState<Array<{ id: string; text: string }>>(() => {
    if (faqCount === 0) return [];
    const faqIdx = brief.h2_list.findIndex(h2 => FAQ_RE.test(h2.text));
    if (faqIdx === -1) return [];
    return brief.h2_list[faqIdx].h3s.map((q, i) => ({ id: `faq-${i}`, text: q }));
  });

  const [faqHeading, setFaqHeading] = useState<string>(() => {
    if (faqCount === 0) return 'Часто задаваемые вопросы';
    const faqIdx = brief.h2_list.findIndex(h2 => FAQ_RE.test(h2.text));
    return faqIdx !== -1 ? brief.h2_list[faqIdx].text : 'Часто задаваемые вопросы';
  });
  const [faqHeadingEditing, setFaqHeadingEditing] = useState(false);

  const [h2List, setH2List] = useState<HeadingItem[]>(() =>
    brief.h2_list
      .filter(h2 => !(faqCount > 0 && FAQ_RE.test(h2.text)))
      .map((h2, i) => ({
        id: `h2-${i}`,
        text: h2.text,
        h3s: h2.h3s.map((h3, j) => ({ id: `h3-${i}-${j}`, text: h3 })),
      }))
  );

  const [mainKeyword, setMainKeyword] = useState(brief.main_keyword ?? '');
  const [lsiKeywords, setLsiKeywords] = useState<string[]>(brief.lsi_keywords ?? []);
  const [newLsi, setNewLsi] = useState('');
  const [tableTopic, setTableTopic] = useState(brief.table_topic ?? '');
  const [caseTopic, setCaseTopic] = useState(brief.case_topic ?? '');

  const [h2Theses, setH2Theses] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    brief.h2_list.filter(h2 => !FAQ_RE.test(h2.text)).forEach((h2, i) => {
      map[`h2-${i}`] = h2.thesis ?? '';
    });
    return map;
  });

  const [h2Facts, setH2Facts] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    brief.h2_list.filter(h2 => !FAQ_RE.test(h2.text)).forEach((h2, i) => {
      map[`h2-${i}`] = h2.facts ?? [];
    });
    return map;
  });

  const [edited, setEdited] = useState(false);

  const [faqEditingId, setFaqEditingId] = useState<string | null>(null);
  const [faqDragIdx, setFaqDragIdx] = useState<number | null>(null);
  const [faqDragOverIdx, setFaqDragOverIdx] = useState<number | null>(null);

  const maxFaqAllowed = getMaxFaqForCharCount(charCount);
  const faqLimit = Math.min(maxFaqAllowed, 10);

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
      thesis: h2Theses[h2.id] ?? '',
      facts: h2Facts[h2.id] ?? [],
    }));

    if (faqCount > 0 && faqQuestions.length > 0) {
      h2ListPlain.push({
        text: faqHeading,
        h3s: faqQuestions.map(q => q.text),
        thesis: '',
        facts: [],
      });
    }

    const updatedBrief: BriefData = {
      ...brief,
      h1,
      h2_list: h2ListPlain,
      main_keyword: mainKeyword,
      lsi_keywords: lsiKeywords,
      table_topic: tableTopic,
      case_topic: caseTopic,
    };
    onConfirm(updatedBrief, edited);
  }, [brief, h1, h2List, h2Theses, h2Facts, faqQuestions, faqCount, faqHeading, mainKeyword, lsiKeywords, tableTopic, caseTopic, edited, onConfirm]);

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
      if (prev.length >= faqLimit) return prev;
      const id = genFaqId();
      const next = [...prev];
      next.splice(idx + 1, 0, { id, text: 'Новый вопрос' });
      setFaqEditingId(id);
      return next;
    });
    setEdited(true);
  }, [faqLimit]);

  const faqAddBottom = useCallback(() => {
    setFaqQuestions(prev => {
      if (prev.length >= faqLimit) return prev;
      const id = genFaqId();
      setFaqEditingId(id);
      return [...prev, { id, text: 'Новый вопрос' }];
    });
    setEdited(true);
  }, [faqLimit]);

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
          <strong className="font-medium text-[var(--color-text-primary)]">{h2Count}</strong>/{structureLimits.maxH2} H2
        </span>
        <span className="rounded-[var(--radius-sm)] bg-[#F5F5F5] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
          <strong className="font-medium text-[var(--color-text-primary)]">{h3Count}</strong>/{structureLimits.maxH3Total} H3
        </span>
        <span className="rounded-[var(--radius-sm)] bg-[#F5F5F5] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
          <strong className="font-medium text-[var(--color-text-primary)]">{faqQuestions.length}</strong>/{faqLimit} FAQ
        </span>
        <span className="rounded-[var(--radius-sm)] bg-[#F5F5F5] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
          <strong className="font-medium text-[var(--color-text-primary)]">{calculatedPrice.toLocaleString('ru-RU')}</strong> ₽
        </span>
      </div>

      {/* Заголовки */}
      <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
          <span>Структура заголовков</span>
          <span className="font-normal text-[var(--color-step-pending)]">перетаскивайте для изменения порядка</span>
        </div>
        <BriefHeadings h1={h1} h2List={h2List} onH1Change={handleH1Change} onChange={handleH2Change} limits={structureLimits} />
      </div>

      {/* Карточка 1: Основной ключ */}
      <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
        <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Основной ключ</div>
        <input
          value={mainKeyword}
          onChange={e => { setMainKeyword(e.target.value); setEdited(true); }}
          maxLength={200}
          placeholder="Основной поисковый запрос"
          className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--seo-input-focus)]"
        />
        <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">LLM выбрал этот ключ как главный. Можете изменить</div>
      </div>

      {/* Карточка 2: LSI-ключи */}
      <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
        <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">LSI-ключи ({lsiKeywords.length})</div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {lsiKeywords.map((kw, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[12px] text-[var(--color-text-primary)]">
              {kw}
              <button onClick={() => { setLsiKeywords(prev => prev.filter((_, j) => j !== i)); setEdited(true); }}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-step-error)]">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newLsi}
            onChange={e => setNewLsi(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newLsi.trim()) {
                setLsiKeywords(prev => [...prev, newLsi.trim()]);
                setNewLsi('');
                setEdited(true);
              }
            }}
            placeholder="Добавить LSI-ключ..."
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-1.5 text-[12px] outline-none focus:border-[var(--seo-input-focus)]"
          />
          <button
            onClick={() => { if (newLsi.trim()) { setLsiKeywords(prev => [...prev, newLsi.trim()]); setNewLsi(''); setEdited(true); }}}
            disabled={!newLsi.trim()}
            className="rounded-[var(--radius-md)] bg-[#F5F5F5] px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:bg-[#E8E8E8] disabled:opacity-40"
          >+</button>
        </div>
        <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Семантически связанные слова. Enter для добавления</div>
      </div>

      {/* Карточка 3: Тезисы и факты к разделам */}
      <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
        <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Тезисы и факты к разделам</div>
        <div className="space-y-3">
          {h2List.map(h2 => (
            <div key={h2.id} className="rounded-[var(--radius-md)] border border-[#F0F0F0] bg-[#FAFAFA] p-3">
              <div className="mb-1.5 text-[12px] font-medium text-[var(--color-text-primary)]">{h2.text}</div>
              <div className="mb-1 text-[11px] text-[var(--color-text-secondary)]">Тезис — о чём этот раздел:</div>
              <input
                value={h2Theses[h2.id] ?? ''}
                onChange={e => { setH2Theses(prev => ({ ...prev, [h2.id]: e.target.value })); setEdited(true); }}
                maxLength={300}
                placeholder="Краткое описание фокуса раздела..."
                className="mb-2 w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--seo-input-focus)]"
              />
              <div className="mb-1 text-[11px] text-[var(--color-text-secondary)]">Факты и цифры для раздела:</div>
              {(h2Facts[h2.id] ?? []).map((fact, fi) => (
                <div key={fi} className="mb-1 flex items-center gap-1.5">
                  <input
                    value={fact}
                    onChange={e => {
                      setH2Facts(prev => {
                        const facts = [...(prev[h2.id] ?? [])];
                        facts[fi] = e.target.value;
                        return { ...prev, [h2.id]: facts };
                      });
                      setEdited(true);
                    }}
                    className="flex-1 rounded border border-[var(--seo-input-border)] bg-white px-2 py-1 text-[12px] outline-none focus:border-[var(--seo-input-focus)]"
                  />
                  <button onClick={() => {
                    setH2Facts(prev => ({ ...prev, [h2.id]: (prev[h2.id] ?? []).filter((_, j) => j !== fi) }));
                    setEdited(true);
                  }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-step-error)] text-sm">×</button>
                </div>
              ))}
              <button
                onClick={() => { setH2Facts(prev => ({ ...prev, [h2.id]: [...(prev[h2.id] ?? []), ''] })); setEdited(true); }}
                className="mt-1 text-[11px] text-[var(--color-accent)] hover:underline"
              >+ Добавить факт</button>
            </div>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Добавьте реальные цифры и факты из вашего бизнеса — LLM использует их при написании</div>
      </div>

      {/* Карточка 4: Темы контентных блоков */}
      {(comparisonEnabled || true) && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
          <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Темы контентных блоков</div>
          {comparisonEnabled && (
            <div className="mb-3">
              <div className="mb-1 text-[11px] text-[var(--color-text-secondary)]">Тема блока сравнения</div>
              <input
                value={tableTopic}
                onChange={e => { setTableTopic(e.target.value); setEdited(true); }}
                maxLength={200}
                placeholder="Что именно сравнивать..."
                className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--seo-input-focus)]"
              />
            </div>
          )}
          <div>
            <div className="mb-1 text-[11px] text-[var(--color-text-secondary)]">Тема личного опыта / кейса</div>
            <input
              value={caseTopic}
              onChange={e => { setCaseTopic(e.target.value); setEdited(true); }}
              maxLength={300}
              placeholder="Опишите свой реальный кейс или опыт по теме..."
              className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--seo-input-focus)]"
            />
            <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">LLM встроит ваш опыт в текст. Чем конкретнее — тем лучше</div>
          </div>
        </div>
      )}

      {/* FAQ блок */}
      {faqCount > 0 && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
            <span>FAQ ({faqQuestions.length}/{faqLimit})</span>
            <span className="font-normal text-[var(--color-step-pending)]">перетаскивайте для изменения порядка</span>
          </div>

          {/* FAQ H2-заголовок */}
          <div className="mb-1 flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--seo-card-border)] bg-[#FAFAFA] px-2.5 py-2">
            <span className="invisible text-sm">⠿</span>
            <span className="invisible flex h-[24px] w-[24px] shrink-0" />
            <span className="shrink-0 rounded bg-[var(--seo-badge-h2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-primary)]">H2</span>
            {faqHeadingEditing ? (
              <input
                autoFocus
                defaultValue={faqHeading}
                maxLength={100}
                onBlur={e => {
                  setFaqHeading(e.target.value.trim() || 'Часто задаваемые вопросы');
                  setFaqHeadingEditing(false);
                  setEdited(true);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setFaqHeading((e.target as HTMLInputElement).value.trim() || 'Часто задаваемые вопросы');
                    setFaqHeadingEditing(false);
                    setEdited(true);
                  }
                  if (e.key === 'Escape') setFaqHeadingEditing(false);
                }}
                className="min-w-0 flex-1 rounded border border-[var(--seo-input-focus)] px-1.5 py-0.5 text-[13px] outline-none"
              />
            ) : (
              <span className="min-w-0 flex-1 break-words text-[13px] text-[var(--color-text-primary)]" style={{ lineHeight: '1.2' }}>
                {faqHeading}
              </span>
            )}
            <button onClick={() => setFaqHeadingEditing(true)} className="shrink-0 text-sm text-[var(--color-step-pending)] hover:text-[var(--color-text-primary)]">✏</button>
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
                disabled={faqQuestions.length >= faqLimit}
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
            disabled={faqQuestions.length >= faqLimit}
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
