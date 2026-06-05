'use client';

import { useEffect, useState } from 'react';

interface Metrics {
  revenue: number;
  cost: number;
  profit: number;
  articlesTotal: number;
  articlesByDay: { date: string; count: number }[];
  openrouterStatus: string;
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--color-bg-surface)] p-5">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{value}</div>
    </div>
  );
}

function AreaChart({ data }: { data: { date: string; count: number }[] }) {
  const W = 900;
  const H = 260;
  const pad = { top: 20, right: 16, bottom: 28, left: 16 };
  const max = Math.max(1, ...data.map((d) => d.count));
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => pad.left + i * stepX;
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const pts = data.map((d, i) => ({ x: x(i), y: y(d.count) }));

  // сглаженная кривая (Catmull-Rom → Bezier)
  let path = pts.length ? `M ${pts[0].x},${pts[0].y}` : '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  const area = pts.length ? `${path} L ${pts[pts.length - 1].x},${pad.top + innerH} L ${pts[0].x},${pad.top + innerH} Z` : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 260 }}>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill="url(#areaFill)" />}
      {path && <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />}
      {data.map((d, i) => (
        <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" className="fill-[var(--color-text-secondary)]" style={{ fontSize: 10 }}>
          {i % 2 === 0 ? d.date.slice(5) : ''}
        </text>
      ))}
    </svg>
  );
}

export function AnalyticsDashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((r) => r.json())
      .then((j) => (j.data ? setM(j.data) : setError(j.error?.message ?? 'Ошибка')))
      .catch(() => setError('Ошибка загрузки'));
  }, []);

  if (error) return <p className="text-sm text-[var(--color-step-error)]">{error}</p>;
  if (!m) return <p className="text-sm text-[var(--color-text-secondary)]">Загрузка...</p>;

  const rub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Выручка" value={rub(m.revenue)} />
        <Card label="Себестоимость" value={rub(m.cost)} />
        <Card label="Прибыль" value={rub(m.profit)} accent />
        <Card label="Статей всего" value={String(m.articlesTotal)} />
      </div>

      <div className="rounded-xl border border-border bg-[var(--color-bg-surface)] p-5">
        <div className="mb-1 text-sm font-bold text-[var(--color-text-primary)]">Активность генераций</div>
        <div className="mb-4 text-[12px] text-[var(--color-text-secondary)]">Завершённых статей за последние 14 дней</div>
        <AreaChart data={m.articlesByDay} />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-[var(--color-bg-surface)] p-4">
        <span className="size-2.5 rounded-full bg-green-500" />
        <span className="text-sm text-[var(--color-text-primary)]">OpenRouter — работает штатно</span>
        <span className="ml-auto text-[11px] text-[var(--color-text-secondary)]">статус-заглушка</span>
      </div>
    </div>
  );
}
