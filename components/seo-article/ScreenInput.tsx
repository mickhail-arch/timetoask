'use client';

import { useState, useCallback, useMemo } from 'react';
import { calculatePriceClient } from '@/lib/seo-article/price-calculator';
import type { PricingConfig } from '@/lib/seo-article/price-calculator';
import { frontFilterClient } from '@/lib/seo-article/front-filter';
import '@/components/seo-article/tokens.css';

const MAX_IMAGES: Record<number, number> = {
  4000:2, 5000:2, 6000:3, 7000:4, 8000:5, 9000:5, 10000:6,
  11000:6, 12000:7, 13000:7, 14000:8, 15000:8, 16000:9,
  17000:9, 18000:10, 19000:10, 20000:11,
};

function getMaxImages(chars: number): number {
  const keys = Object.keys(MAX_IMAGES).map(Number).sort((a,b) => a-b);
  let max = 2;
  for (const k of keys) { if (chars >= k) max = MAX_IMAGES[k]; }
  return max;
}

const INTENTS = [
  { value: 'informational', label: 'Информационный' },
  { value: 'educational', label: 'Обучающий / Гайд' },
  { value: 'commercial', label: 'Коммерческий' },
  { value: 'comparative', label: 'Сравнительный' },
  { value: 'review', label: 'Обзорный' },
  { value: 'news', label: 'Новостной / Трендовый' },
  { value: 'problem_solution', label: 'Проблема–Решение' },
];

const TONES = ['Экспертный', 'Разговорный', 'Деловой', 'Продающий', 'Научный', 'Простой'];
const GENDERS = ['Все', 'Мужчины', 'Женщины'];
const AGES = ['Все', '0–18', '18–24', '25–34', '35–44', '45–54', '55+'];
const IMG_STYLES = ['Реалистичные', 'Абстрактные', '3D', 'Минимализм', 'Иллюстрации'];

interface ScreenInputProps {
  onSubmit: (input: Record<string, unknown>) => void;
  pricingConfig?: Partial<PricingConfig> | null;
}

export function ScreenInput({ onSubmit, pricingConfig }: ScreenInputProps) {
  const [targetQuery, setTargetQuery] = useState('');
  const [keywords, setKeywords] = useState('');
  const [intent, setIntent] = useState('informational');
  const [charCount, setCharCount] = useState(8000);
  const [imageCount, setImageCount] = useState(0);

  const [tone, setTone] = useState('Экспертный');
  const [customTone, setCustomTone] = useState('');
  const [showCustomTone, setShowCustomTone] = useState(false);
  const [gender, setGender] = useState('Все');
  const [ages, setAges] = useState<string[]>(['Все']);
  const [geo, setGeo] = useState('');
  const [imageStyles, setImageStyles] = useState<string[]>(['Реалистичные']);

  const [accordionOpen, setAccordionOpen] = useState(false);
  const [faqCount, setFaqCount] = useState(5);
  const [brand, setBrand] = useState('');
  const [cta, setCta] = useState('');
  const [ownSources, setOwnSources] = useState('');
  const [forbiddenWords, setForbiddenWords] = useState('');
  const [legalRestrictions, setLegalRestrictions] = useState('');

  const [filterWarning, setFilterWarning] = useState(false);

  const maxImages = useMemo(() => getMaxImages(charCount), [charCount]);

  const price = useMemo(
    () => calculatePriceClient(charCount, imageCount, faqCount, pricingConfig),
    [charCount, imageCount, faqCount, pricingConfig],
  );

  const canSubmit = targetQuery.trim().length >= 3 && keywords.trim().length > 0 && !filterWarning;

  const checkForbidden = useCallback((text: string) => {
    const allText = `${targetQuery} ${keywords} ${text}`;
    const result = frontFilterClient(allText);
    setFilterWarning(!result.clean);
  }, [targetQuery, keywords]);

  const handleCharChange = useCallback((v: number) => {
    setCharCount(v);
    const newMax = getMaxImages(v);
    if (imageCount > newMax) setImageCount(newMax);
  }, [imageCount]);

  const handleToneClick = useCallback((t: string) => {
    if (t === 'Свой...') {
      setShowCustomTone(true);
      setTone('');
    } else {
      setShowCustomTone(false);
      setCustomTone('');
      setTone(t);
    }
  }, []);

  const toggleAge = useCallback((age: string) => {
    if (age === 'Все') { setAges(['Все']); return; }
    setAges(prev => {
      const without = prev.filter(a => a !== 'Все');
      const next = without.includes(age) ? without.filter(a => a !== age) : [...without, age];
      return next.length === 0 ? ['Все'] : next;
    });
  }, []);

  const toggleImageStyle = useCallback((style: string) => {
    setImageStyles(prev => {
      if (prev.includes(style)) return prev.length > 1 ? prev.filter(s => s !== style) : prev;
      return prev.length >= 2 ? [prev[1], style] : [...prev, style];
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit({
      target_query: targetQuery.trim(),
      keywords: keywords.trim(),
      intent,
      target_char_count: charCount,
      image_count: imageCount,
      tone_of_voice: showCustomTone ? customTone : (() => {
        const map: Record<string, string> = { 'Экспертный': 'expert', 'Разговорный': 'casual', 'Деловой': 'business', 'Продающий': 'sales', 'Научный': 'scientific', 'Простой': 'simple' };
        return map[tone] ?? tone.toLowerCase();
      })(),
      target_audience: {
        gender: gender === 'Мужчины' ? 'male' : gender === 'Женщины' ? 'female' : 'all',
        age: ages.includes('Все') ? ['all'] : ages.map(a => {
          const map: Record<string, string> = { '0–18': '0-18', '18–24': '18-24', '25–34': '25-34', '35–44': '35-44', '45–54': '45-54', '55+': '55+' };
          return map[a] ?? a.toLowerCase();
        }),
      },
      geo_location: geo || undefined,
      image_style: imageCount > 0 ? imageStyles.map(s => s.toLowerCase()) : undefined,
      faq_count: faqCount,
      brand: brand || undefined,
      cta: cta || undefined,
      own_sources: ownSources || undefined,
      forbidden_words: forbiddenWords || undefined,
      legal_restrictions: legalRestrictions || undefined,
    });
  }, [canSubmit, targetQuery, keywords, intent, charCount, imageCount, tone, customTone, showCustomTone, gender, ages, geo, imageStyles, faqCount, brand, cta, ownSources, forbiddenWords, legalRestrictions, onSubmit]);

  return (
    <div className="mx-auto max-w-[640px] space-y-3">
      {/* ОБЯЗАТЕЛЬНЫЕ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-5">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Обязательные поля</div>

        <div className="mb-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">
            Целевой поисковый запрос
            <span className="rounded bg-[#FFEAEA] px-1.5 py-0.5 text-[10px] font-medium text-[#DC2626]">обязательно</span>
          </label>
          <input
            type="text"
            value={targetQuery}
            onChange={e => { setTargetQuery(e.target.value); checkForbidden(e.target.value); }}
            placeholder="как выбрать кофемашину для дома"
            className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--seo-input-placeholder)] outline-none transition-colors focus:border-[var(--seo-input-focus)]"
          />
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Именно тот запрос, по которому статья должна ранжироваться</div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">
            Ключевые слова
            <span className="rounded bg-[#FFEAEA] px-1.5 py-0.5 text-[10px] font-medium text-[#DC2626]">обязательно</span>
          </label>
          <textarea
            value={keywords}
            onChange={e => { setKeywords(e.target.value); checkForbidden(e.target.value); }}
            placeholder={'кофемашина для дома\nрожковая кофемашина\nкакую кофемашину купить'}
            rows={3}
            className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--seo-input-placeholder)] outline-none transition-colors focus:border-[var(--seo-input-focus)]"
          />
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">По одному ключу на строку. Основной + LSI-ключи</div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Intent запроса</label>
          <select
            value={intent}
            onChange={e => setIntent(e.target.value)}
            className="w-full appearance-none rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2.5 pr-8 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--seo-input-focus)]"
          >
            {INTENTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Объём статьи</label>
          <div className="flex items-center gap-3">
            <input type="range" min={4000} max={20000} step={1000} value={charCount} onChange={e => handleCharChange(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--seo-card-border)] accent-[var(--color-accent)] outline-none" />
            <span className="min-w-[72px] text-right text-sm font-medium text-[var(--color-text-primary)]">{charCount.toLocaleString('ru-RU')} симв</span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">4 000 – 20 000 символов</div>
        </div>

        <div>
          <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Количество изображений</label>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={maxImages} step={1} value={imageCount} onChange={e => setImageCount(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--seo-card-border)] accent-[var(--color-accent)] outline-none" />
            <span className="min-w-[32px] text-right text-sm font-medium text-[var(--color-text-primary)]">{imageCount}</span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Макс: {maxImages} для {charCount.toLocaleString('ru-RU')} символов</div>
          {imageCount > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="self-center text-xs text-[var(--color-text-secondary)]">Стиль:</span>
              {IMG_STYLES.map(s => (
                <button key={s} onClick={() => toggleImageStyle(s)}
                  className={`rounded-[var(--radius-sm)] border px-3 py-1 text-xs transition-all ${
                    imageStyles.includes(s)
                      ? 'border-[var(--seo-accent-selected-bg)] bg-[var(--seo-accent-selected-bg)] font-medium text-[var(--seo-accent-selected-text)]'
                      : 'border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] text-[var(--color-text-primary)] hover:bg-[#F5F5F5]'
                  }`}>{s}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* РЕКОМЕНДУЕМЫЕ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-5">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Рекомендуемые поля</div>

        <div className="mb-4">
          <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Tone of voice</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map(t => (
              <button key={t} onClick={() => handleToneClick(t)}
                className={`rounded-[var(--radius-md)] border px-4 py-1.5 text-[13px] transition-all ${
                  tone === t
                    ? 'border-[var(--seo-selected-bg)] bg-[var(--seo-selected-bg)] font-medium text-[var(--seo-selected-text)]'
                    : 'border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] text-[var(--color-text-primary)] hover:bg-[#F5F5F5]'
                }`}>{t}</button>
            ))}
            <button onClick={() => handleToneClick('Свой...')}
              className={`rounded-[var(--radius-md)] border px-4 py-1.5 text-[13px] transition-all ${
                showCustomTone
                  ? 'border-[var(--seo-selected-bg)] bg-[var(--seo-selected-bg)] font-medium text-[var(--seo-selected-text)]'
                  : 'border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] text-[var(--color-text-primary)] hover:bg-[#F5F5F5]'
              }`}>Свой...</button>
          </div>
          {showCustomTone && (
            <textarea value={customTone} onChange={e => setCustomTone(e.target.value)} maxLength={300} rows={2} placeholder="Опишите желаемый стиль..."
              className="mt-2 w-full resize-none rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
          )}
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">По умолчанию: Экспертный</div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Целевая аудитория</label>
          <div className="mb-1.5 text-xs text-[var(--color-text-secondary)]">Пол</div>
          <div className="mb-2 flex gap-1.5">
            {GENDERS.map(g => (
              <button key={g} onClick={() => setGender(g)}
                className={`rounded-[var(--radius-sm)] border px-3 py-1 text-xs transition-all ${
                  gender === g
                    ? 'border-[var(--seo-selected-bg)] bg-[var(--seo-selected-bg)] font-medium text-[var(--seo-selected-text)]'
                    : 'border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] text-[var(--color-text-primary)] hover:bg-[#F5F5F5]'
                }`}>{g}</button>
            ))}
          </div>
          <div className="mb-1.5 text-xs text-[var(--color-text-secondary)]">Возраст</div>
          <div className="flex flex-wrap gap-1.5">
            {AGES.map(a => (
              <button key={a} onClick={() => toggleAge(a)}
                className={`rounded-[var(--radius-sm)] border px-3 py-1 text-xs transition-all ${
                  ages.includes(a)
                    ? 'border-[var(--seo-selected-bg)] bg-[var(--seo-selected-bg)] font-medium text-[var(--seo-selected-text)]'
                    : 'border-[var(--seo-btn-default-border)] bg-[var(--seo-btn-default-bg)] text-[var(--color-text-primary)] hover:bg-[#F5F5F5]'
                }`}>{a}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Гео</label>
          <input type="text" value={geo} onChange={e => setGeo(e.target.value)} placeholder="Москва, Санкт-Петербург, Новосибирск..."
            className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--seo-input-placeholder)] outline-none transition-colors focus:border-[var(--seo-input-focus)]" />
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Город или регион. Пустое — вся Россия</div>
        </div>
      </div>

      {/* ДОПОЛНИТЕЛЬНЫЕ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-5">
        <button onClick={() => setAccordionOpen(v => !v)} className="flex w-full items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Дополнительные настройки</span>
          <span className="rounded bg-[#F5F5F5] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">6 полей {accordionOpen ? '▴' : '▾'}</span>
        </button>
        {accordionOpen && (
          <div className="mt-4 space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">FAQ-вопросов</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={10} step={1} value={faqCount} onChange={e => setFaqCount(Number(e.target.value))}
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--seo-card-border)] accent-[var(--color-accent)] outline-none" />
                  <span className="min-w-[24px] text-right text-sm font-medium">{faqCount}</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Бренд</label>
                <input type="text" value={brand} onChange={e => setBrand(e.target.value)} maxLength={100} placeholder="CoffeeShop.ru"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Пусто → без упоминания</div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">CTA в конце статьи</label>
              <textarea value={cta} onChange={e => setCta(e.target.value)} maxLength={500} rows={2} placeholder="Подберите кофемашину в нашем каталоге →"
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
              <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Пусто → без CTA-блока</div>
            </div>
            <div>
              <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Ссылки на собственные источники</label>
              <textarea value={ownSources} onChange={e => setOwnSources(e.target.value)} rows={2} placeholder={'https://site.ru/research\nhttps://site.ru/review'}
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
              <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">URL ваших материалов, по одному на строку. Усиливает EEAT</div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Запрещённые слова</label>
                <textarea value={forbiddenWords} onChange={e => setForbiddenWords(e.target.value)} maxLength={500} rows={2} placeholder={'дешёвый\nкитайский'}
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">По одному на строку</div>
              </div>
              <div className="flex-1">
                <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Юридические ограничения</label>
                <textarea value={legalRestrictions} onChange={e => setLegalRestrictions(e.target.value)} maxLength={500} rows={2} placeholder="Не использовать слово «гарантирует»"
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Для медицины, финансов, права</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ЦЕНА */}
      <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-[#F5F5F5] px-4 py-2.5 text-[13px]">
        <div>
          <span>Стоимость генерации:</span>
          <div className="text-[11px] text-[var(--color-text-secondary)]">
            база {price.base} + объём {price.chars} + картинки {price.images} + FAQ {price.faq}
          </div>
        </div>
        <div className="text-[15px] font-medium">{price.total} токенов</div>
      </div>

      {/* ПРЕДУПРЕЖДЕНИЕ ФИЛЬТРА */}
      {filterWarning && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-step-error)] bg-[#FFF5F5] px-4 py-2.5 text-xs text-[var(--color-step-error)]">
          Обнаружены запрещённые слова. Уберите их для продолжения.
        </div>
      )}

      {/* НОТА */}
      <div className="flex items-start gap-2 rounded-r-[var(--radius-md)] border-l-[3px] border-[var(--color-accent)] bg-[var(--color-brief-bg)] px-3 py-2.5 text-[13px]">
        <span className="text-[var(--color-accent)]">●</span>
        <span>Минимум для старта: заполните запрос и ключевые слова. <em className="text-[var(--color-text-secondary)]">Чем больше полей — тем точнее результат.</em></span>
      </div>

      {/* КНОПКА */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full rounded-[var(--radius-md)] py-3.5 text-[15px] font-medium transition-all ${
          canSubmit
            ? 'bg-[var(--seo-btn-primary-bg)] text-[var(--seo-btn-primary-text)] hover:brightness-95 cursor-pointer'
            : 'bg-[var(--seo-card-border)] text-[var(--color-text-secondary)] cursor-not-allowed'
        }`}
      >
        Создать статью →
      </button>
    </div>
  );
}
