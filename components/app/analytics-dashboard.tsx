// components/app/analytics-dashboard.tsx

'use client';

import { useEffect, useState } from 'react';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';

interface Metrics {
  revenue: number;
  cost: number;
  profit: number;
  articlesTotal: number;
  openrouterStatus: string;
}

interface Activity { points: { label: string; count: number }[]; total: number }

function pluralArticles(n: number): string {
  const a = Math.abs(n) % 100;
  const b = n % 10;
  if (a > 10 && a < 20) return 'статей';
  if (b > 1 && b < 5) return 'статьи';
  if (b === 1) return 'статья';
  return 'статей';
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--color-bg-surface)] p-5">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{value}</div>
    </div>
  );
}

function ActivityChart({ data }: { data: { label: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 900, H = 150;
  const pad = { top: 16, right: 24, bottom: 28, left: 36 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const bottom = pad.top + innerH;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => pad.left + i * stepX;
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const clampY = (v: number) => Math.max(pad.top, Math.min(bottom, v));
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.count) }));

  let path = pts.length ? `M ${pts[0].x},${pts[0].y}` : '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    path += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  const area = pts.length ? `${path} L ${pts[pts.length - 1].x},${bottom} L ${pts[0].x},${bottom} Z` : '';

  const yTicks = Array.from(new Set(Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i))));
  const stride = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}` }} onMouseLeave={() => setHover(null)}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.left} y1={y(t)} x2={W - pad.right} y2={y(t)} stroke="var(--color-border)" strokeOpacity="0.6" strokeWidth="1" />
            <text x={pad.left - 6} y={y(t) + 3} textAnchor="end" className="fill-[var(--color-text-secondary)]" style={{ fontSize: 10 }}>{t}</text>
          </g>
        ))}
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill="url(#areaFill)" />}
        {path && <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 4.5 : 3} fill="var(--color-accent)" stroke="none" />
        ))}
        {data.map((d, i) => ((i % stride === 0 || i === data.length - 1) ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-[var(--color-text-secondary)]" style={{ fontSize: 10 }}>{d.label}</text>
        ) : null))}
        {data.map((d, i) => (
          <rect key={i} x={x(i) - (stepX || innerW) / 2} y={pad.top} width={stepX || innerW} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-page)] px-2 py-1 text-[11px] shadow-lg whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].count) / H) * 100}%` }}
        >
          <div className="text-[var(--color-text-secondary)]">{data[hover].label}</div>
          <div className="font-semibold text-[var(--color-text-primary)]">{data[hover].count} {pluralArticles(data[hover].count)}</div>
        </div>
      )}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    setM(null);
    fetch(`/api/admin/analytics?${p.toString()}`)
      .then((r) => r.json())
      .then((j) => (j.data ? setM(j.data) : setError(j.error?.message ?? 'Ошибка')))
      .catch(() => setError('Ошибка загрузки'));
  }, [from, to]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    setActivity(null);
    fetch(`/api/admin/analytics/activity?${p.toString()}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setActivity(j.data); })
      .catch(() => {});
  }, [from, to]);

  if (error) return <p className="text-sm text-[var(--color-step-error)]">{error}</p>;

  const rub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;
  const periodLabel = from || to ? 'за выбранный период' : 'за всё время';

  return (
    <div className="space-y-6">
      <DateRangePicker
        value={{ from: from || null, to: to || null }}
        onApply={(r: DateRange) => { setFrom(r.from ?? ''); setTo(r.to ?? ''); }}
      />

      {!m ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Загрузка...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card label="Выручка" value={rub(m.revenue)} />
            <Card label="Себестоимость" value={rub(m.cost)} />
            <Card label="Прибыль" value={rub(m.profit)} accent />
            <Card label="Статей всего" value={String(m.articlesTotal)} />
          </div>

          <div className="rounded-xl border border-border bg-[var(--color-bg-surface)] p-5">
            <div className="mb-3">
              <div className="text-sm font-bold text-[var(--color-text-primary)]">Активность генераций</div>
              <div className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Завершённые статьи {periodLabel}</div>
              <div className="mt-1 text-3xl font-bold text-[var(--color-text-primary)]">{activity ? activity.total : '—'}</div>
            </div>
            {activity
              ? <ActivityChart data={activity.points} />
              : <div className="flex h-[150px] items-center justify-center text-sm text-[var(--color-text-secondary)]">Загрузка...</div>}
          </div>
        </>
      )}
    </div>
  );
}
