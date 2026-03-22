'use client';

interface QualityMetrics {
  ai_score: number; water: number; spam: number;
  nausea_classic: number; nausea_academic: number;
  uniqueness: number; readability: number;
  char_count: number; word_count: number;
  h2_count: number; h3_count: number;
  image_count: number; faq_count: number;
}

function metricColor(value: number, green: [number, number], red: number, invert = false): string {
  if (invert) return value >= green[0] && value <= green[1] ? 'var(--color-metric-green)' : value < red ? 'var(--color-metric-red)' : 'var(--color-metric-yellow)';
  return value >= green[0] && value <= green[1] ? 'var(--color-metric-green)' : value > red ? 'var(--color-metric-red)' : 'var(--color-metric-yellow)';
}

export function QualityPanel({ metrics }: { metrics: QualityMetrics }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-4">
      <div className="mb-2.5 flex items-center justify-between border-b border-[#F0F0F0] pb-2.5">
        <div className="text-[15px] font-medium">{metrics.char_count.toLocaleString('ru-RU')} символов · {metrics.word_count.toLocaleString('ru-RU')} слов</div>
        <div className="text-xs text-[var(--color-text-secondary)]">H2: {metrics.h2_count} · H3: {metrics.h3_count} · Фото: {metrics.image_count} · FAQ: {metrics.faq_count}</div>
      </div>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Качество</div>
      <div className="mb-2 grid grid-cols-4 gap-2">
        <Metric label="AI-детект" value={`${metrics.ai_score}%`} color={metricColor(metrics.ai_score, [0, 35], 50)} />
        <Metric label="Водность" value={`${metrics.water}%`} color={metricColor(metrics.water, [10, 20], 25)} />
        <Metric label="Заспамленность" value={`${metrics.spam}%`} color={metricColor(metrics.spam, [30, 50], 60)} />
        <Metric label="Уникальность" value={`${metrics.uniqueness}%`} color={metricColor(metrics.uniqueness, [85, 100], 80, true)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Тошнота" value={`${metrics.nausea_classic}`} color={metricColor(metrics.nausea_classic, [0, 7], 8)} />
        <Metric label="Акад. тошнота" value={`${metrics.nausea_academic}%`} color={metricColor(metrics.nausea_academic, [5, 8], 9)} />
        <Metric label="Читабельность" value={`${metrics.readability}`} color={metricColor(metrics.readability, [7, 10], 6, true)} />
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[#F5F5F5] px-2.5 py-2">
      <div className="text-[10px] text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-[16px] font-medium" style={{ color }}>{value}</div>
    </div>
  );
}
