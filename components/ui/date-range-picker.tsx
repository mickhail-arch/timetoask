'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface DateRange { from: string | null; to: string | null }

interface Props {
  value: DateRange;
  onApply: (range: DateRange) => void;
  months?: number;        // сколько месяцев показывать (по умолчанию 2)
  className?: string;
}

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = (s: string | null) => (s ? new Date(s + 'T00:00:00') : null);
const fmtRu = (s: string | null) => (s ? s.split('-').reverse().join('.') : '');

function monthMatrix(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // понедельник = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DateRangePicker({ value, onApply, months = 2, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(value.from);
  const [end, setEnd] = useState<string | null>(value.to);
  const [baseDate, setBaseDate] = useState(() => fromYmd(value.to) ?? fromYmd(value.from) ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setStart(value.from); setEnd(value.to); }, [value.from, value.to]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const monthsToShow = useMemo(() => {
    const arr: { y: number; m: number }[] = [];
    const b = new Date(baseDate.getFullYear(), baseDate.getMonth() - (months - 1), 1);
    for (let i = 0; i < months; i++) { const d = new Date(b.getFullYear(), b.getMonth() + i, 1); arr.push({ y: d.getFullYear(), m: d.getMonth() }); }
    return arr;
  }, [baseDate, months]);

  const pick = (d: Date) => {
    const s = ymd(d);
    if (!start || (start && end)) { setStart(s); setEnd(null); return; }
    if (s < start) { setEnd(start); setStart(s); return; }
    setEnd(s);
  };

  const inRange = (d: Date) => {
    if (!start) return false;
    const s = ymd(d);
    const lo = start;
    const hi = end ?? start;
    return s >= lo && s <= hi;
  };
  const isEdge = (d: Date) => { const s = ymd(d); return s === start || s === end; };

  const days = end ? Math.round((fromYmd(end)!.getTime() - fromYmd(start!)!.getTime()) / 86400000) + 1 : (start ? 1 : 0);

  const apply = () => { onApply({ from: start, to: end ?? start }); setOpen(false); };

  const applyPreset = (kind: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'quarter') => {
    if (kind === 'all') {
      setStart(null);
      setEnd(null);
      onApply({ from: null, to: null });
      return;
    }
    const now = new Date();
    let f = new Date(now);
    const t = new Date(now);
    if (kind === 'yesterday') { f.setDate(f.getDate() - 1); t.setDate(t.getDate() - 1); }
    else if (kind === 'week') { f.setDate(f.getDate() - 6); }
    else if (kind === 'month') { f.setDate(f.getDate() - 29); }
    else if (kind === 'quarter') { f.setDate(f.getDate() - 89); }
    const range = { from: ymd(f), to: ymd(t) };
    setStart(range.from); setEnd(range.to);
    onApply(range);
  };

  const label = value.from || value.to
    ? `${fmtRu(value.from)}${value.to && value.to !== value.from ? ' — ' + fmtRu(value.to) : ''}`
    : 'Выбрать период';

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <div className="flex flex-wrap items-center gap-1">
        <button
          onClick={() => applyPreset('all')}
          className="rounded-md px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-page)] hover:text-[var(--color-text-primary)]"
        >
          Весь период
        </button>
        {([
          { k: 'today', t: 'Сегодня' },
          { k: 'yesterday', t: 'Вчера' },
          { k: 'week', t: 'Неделя' },
          { k: 'month', t: 'Месяц' },
          { k: 'quarter', t: 'Квартал' },
        ] as const).map((p) => (
          <button
            key={p.k}
            onClick={() => applyPreset(p.k)}
            className="rounded-md px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-page)] hover:text-[var(--color-text-primary)]"
          >
            {p.t}
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-1.5 text-[13px] text-[var(--color-text-primary)]"
        >
          <span>{label}</span>
          <span className="text-[var(--color-text-secondary)]">▾</span>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-page)] p-4 shadow-xl">
          <div className="mb-2 flex items-center gap-2">
            <button onClick={() => setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1))} className="rounded px-2 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">←</button>
            <button onClick={() => setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1))} className="ml-auto rounded px-2 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">→</button>
          </div>
          <div className="flex gap-6">
            {monthsToShow.map(({ y, m }) => (
              <div key={`${y}-${m}`}>
                <div className="mb-2 text-center text-[13px] font-medium text-[var(--color-text-primary)]">{MN[m]} {y}</div>
                <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-[var(--color-text-secondary)]">
                  {WD.map((w) => <div key={w} className="py-1">{w}</div>)}
                  {monthMatrix(y, m).map((d, i) => {
                    if (!d) return <div key={i} />;
                    const edge = isEdge(d);
                    const within = inRange(d);
                    return (
                      <button
                        key={i}
                        onClick={() => pick(d)}
                        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-md text-[13px] transition-colors ${
                          edge
                            ? 'bg-[var(--color-border)] font-semibold text-[var(--color-text-primary)] ring-1 ring-[var(--color-text-secondary)]'
                            : within
                              ? 'bg-[var(--color-border)]/50 text-[var(--color-text-primary)]'
                              : 'text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/40'
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-[13px] text-[var(--color-text-primary)]">{fmtRu(start) || 'дд.мм.гггг'}</span>
            <span className="text-[var(--color-text-secondary)]">—</span>
            <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-[13px] text-[var(--color-text-primary)]">{fmtRu(end) || 'дд.мм.гггг'}</span>
            {days > 0 && <span className="text-[12px] text-[var(--color-text-secondary)]">{days} дней</span>}
            <button onClick={apply} disabled={!start} className="ml-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-page)] px-4 py-1.5 text-[13px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] disabled:opacity-50">Применить</button>
          </div>
        </div>
      )}
    </div>
  );
}
