'use client';

import { useState, useCallback } from 'react';

export interface RewritePanelProps {
  fragment: string;
  contextBefore: string;
  contextAfter: string;
  sectionTitle: string;
  articleTitle: string;
  position: { top: number };
  onApply: (rewritten: string) => void;
  onCancel: () => void;
}

export function RewritePanel({
  fragment, contextBefore, contextAfter, sectionTitle, articleTitle,
  position, onApply, onCancel,
}: RewritePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);

  const plainFragment = fragment.replace(/<[^>]*>/g, '');
  const estimatedPrice = Math.max(3, Math.ceil(plainFragment.length / 100) * 0.7);

  const handleRewrite = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/tools/rewrite-fragment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fragment, contextBefore, contextAfter, sectionTitle, articleTitle,
          userPrompt: prompt.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Ошибка');
        return;
      }
      setResult(json.data.rewritten);
      setPrice(json.data.price);
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }, [prompt, fragment, contextBefore, contextAfter, sectionTitle, articleTitle]);

  return (
    <div
      className="absolute right-0 z-50 w-[300px] rounded-[12px] border border-[#E0E0E0] bg-white p-4 shadow-lg"
      style={{ top: position.top, transform: 'translateX(calc(100% + 16px))' }}
    >
      {/* Выделенный фрагмент */}
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#999]">Выделенный текст</div>
        <div className="max-h-[80px] overflow-y-auto rounded bg-[#F5F5F5] px-2.5 py-2 text-[12px] text-[#666] leading-relaxed">
          {plainFragment.length > 200 ? plainFragment.slice(0, 200) + '...' : plainFragment}
        </div>
      </div>

      {/* Промпт */}
      {!result && (
        <>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Перефразируй проще..."
            disabled={loading}
            className="mb-2 w-full resize-none rounded-[8px] border border-[#E0E0E0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
          />
          <div className="mb-3 flex items-center justify-between text-[11px] text-[#999]">
            <span>{prompt.length}/300</span>
            <span>~{estimatedPrice.toFixed(1)} ₽</span>
          </div>
          {error && (
            <div className="mb-2 rounded bg-[#FFF5F5] px-2.5 py-1.5 text-[11px] text-[#DC2626]">{error}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleRewrite}
              disabled={loading || !prompt.trim()}
              className="flex-1 rounded-[8px] bg-[var(--color-accent)] py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {loading ? 'Переписываю...' : 'Переписать'}
            </button>
            <button
              onClick={onCancel}
              className="rounded-[8px] border border-[#E0E0E0] px-3 py-2 text-[13px] text-[#666] hover:bg-[#F5F5F5]"
            >
              Отмена
            </button>
          </div>
        </>
      )}

      {/* Результат */}
      {result && (
        <>
          <div className="mb-3">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#999]">Результат</div>
            <div
              className="max-h-[200px] overflow-y-auto rounded bg-[#F0FFF0] px-2.5 py-2 text-[12px] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: result }}
            />
          </div>
          {price !== null && (
            <div className="mb-2 text-[11px] text-[#999]">Списано: {price} ₽</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onApply(result)}
              className="flex-1 rounded-[8px] bg-[var(--color-accent)] py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90"
            >
              Применить
            </button>
            <button
              onClick={() => { setResult(null); setPrompt(''); }}
              className="rounded-[8px] border border-[#E0E0E0] px-3 py-2 text-[13px] text-[#666] hover:bg-[#F5F5F5]"
            >
              Заново
            </button>
            <button
              onClick={onCancel}
              className="rounded-[8px] border border-[#E0E0E0] px-3 py-2 text-[13px] text-[#666] hover:bg-[#F5F5F5]"
            >
              Отмена
            </button>
          </div>
        </>
      )}
    </div>
  );
}
