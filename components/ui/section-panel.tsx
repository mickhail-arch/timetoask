'use client';

import { useState } from 'react';
import { SECTION_MODELS, SECTION_RANGES, calculateSectionPrice, type SectionModel } from '@/modules/section-generator/pricing';

export interface SectionPanelProps {
  articleTitle: string;
  contextBefore: string;
  position: { top: number; left: number };
  onApply: (html: string) => void;
  onCancel: () => void;
}

export function SectionPanel({ articleTitle, contextBefore, position, onApply, onCancel }: SectionPanelProps) {
  const [heading, setHeading] = useState('');
  const [level, setLevel] = useState<'h2' | 'h3'>('h2');
  const [model, setModel] = useState<SectionModel>('sonnet');
  const range = SECTION_RANGES[level];
  const [chars, setChars] = useState<number>(range.default);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = calculateSectionPrice(chars, model);

  const switchLevel = (next: 'h2' | 'h3') => {
    setLevel(next);
    const r = SECTION_RANGES[next];
    setChars((c) => Math.min(r.max, Math.max(r.min, c)));
  };

  const handleGenerate = async () => {
    if (heading.trim().length < 3) { setError('Введите заголовок раздела'); return; }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heading: heading.trim(), level, targetChars: chars, model, articleTitle, contextBefore }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? 'Ошибка'); return; }
      setResult(json.data.html);
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="absolute z-50 w-[320px] rounded-[12px] border border-[var(--seo-card-border)] bg-[var(--seo-btn-default-bg)] p-4 shadow-lg"
      style={{ top: position.top, left: Math.max(0, position.left) }}
    >
      {!result && (
        <>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[#999]">Добавить раздел</div>
          <input
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            maxLength={200}
            placeholder="Заголовок раздела..."
            disabled={loading}
            className="mb-3 w-full rounded-[8px] border border-[var(--seo-card-border)] bg-[var(--seo-btn-default-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
          />

          {/* H2 / H3 — выбор ИЛИ */}
          <div className="mb-3 flex gap-2">
            {(['h2', 'h3'] as const).map((lv) => (
              <button
                key={lv}
                onClick={() => switchLevel(lv)}
                className={`flex-1 rounded-[8px] py-1.5 text-[12px] font-medium transition-colors ${
                  level === lv ? 'bg-[var(--color-accent)] text-black' : 'border border-[var(--seo-card-border)] text-[var(--color-text-secondary)]'
                }`}
              >
                {lv.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Модель — 3 кнопки */}
          <div className="mb-3 flex gap-2">
            {SECTION_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`flex-1 rounded-[8px] py-1.5 text-[12px] font-medium transition-colors ${
                  model === m.id ? 'bg-[var(--color-accent)] text-black' : 'border border-[var(--seo-card-border)] text-[var(--color-text-secondary)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Бегунок объёма */}
          <div className="mb-1 flex items-center justify-between text-[11px] text-[#999]">
            <span>Объём</span>
            <span>{chars} симв.</span>
          </div>
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={chars}
            onChange={(e) => setChars(Number(e.target.value))}
            className="mb-3 w-full accent-[var(--color-accent)]"
          />

          <div className="mb-3 flex items-center justify-end text-[11px] text-[#999]">~{price} ₽</div>

          {error && <div className="mb-2 rounded bg-[#FFF5F5] px-2.5 py-1.5 text-[11px] text-[#DC2626]">{error}</div>}

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading || heading.trim().length < 3}
              className="flex-1 rounded-[8px] bg-[var(--color-accent)] py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {loading ? 'Генерация...' : 'Сгенерировать'}
            </button>
            <button onClick={onCancel} className="rounded-[8px] border border-[var(--seo-card-border)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-page)]">
              Отмена
            </button>
          </div>
        </>
      )}

      {result && (
        <>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#999]">Результат</div>
          <div className="mb-3 max-h-[220px] overflow-y-auto rounded bg-[#F0FFF0] px-2.5 py-2 text-[12px] leading-relaxed" dangerouslySetInnerHTML={{ __html: result }} />
          <div className="mb-2 text-[11px] text-[#999]">Списано: {price} ₽</div>
          <div className="flex gap-2">
            <button onClick={() => onApply(result)} className="flex-1 rounded-[8px] bg-[var(--color-accent)] py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90">
              Вставить
            </button>
            <button onClick={() => setResult(null)} className="rounded-[8px] border border-[var(--seo-card-border)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-page)]">
              Заново
            </button>
            <button onClick={onCancel} className="rounded-[8px] border border-[var(--seo-card-border)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-page)]">
              Отмена
            </button>
          </div>
        </>
      )}
    </div>
  );
}
