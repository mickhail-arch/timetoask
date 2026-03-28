'use client';

import { useState, useCallback, useMemo } from 'react';
import { calculatePriceClient } from '@/lib/seo-article/price-calculator';
import type { PricingConfig } from '@/lib/seo-article/price-calculator';
import { frontFilterClient } from '@/lib/seo-article/front-filter';
import { searchGeo } from '@/core/constants';
import { formatUrlInput, getUrlError } from '@/core/utils';
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
  initialValues?: Record<string, unknown>;
}

export function ScreenInput({ onSubmit, pricingConfig, initialValues }: ScreenInputProps) {
  const iv = initialValues;

  const toneRevMap: Record<string, string> = { expert: 'Экспертный', casual: 'Разговорный', business: 'Деловой', sales: 'Продающий', scientific: 'Научный', simple: 'Простой' };
  const ivToneRaw = (iv?.tone_of_voice as string) ?? '';
  const ivToneDisplay = toneRevMap[ivToneRaw];
  const ivIsCustomTone = !!ivToneRaw && !ivToneDisplay;

  const genderRevMap: Record<string, string> = { male: 'Мужчины', female: 'Женщины', all: 'Все' };
  const ageRevMap: Record<string, string> = { all: 'Все', '0-18': '0–18', '18-24': '18–24', '25-34': '25–34', '35-44': '35–44', '45-54': '45–54', '55+': '55+' };
  const styleRevMap: Record<string, string> = { 'реалистичные': 'Реалистичные', 'абстрактные': 'Абстрактные', '3d': '3D', 'минимализм': 'Минимализм', 'иллюстрации': 'Иллюстрации' };
  const ta = iv?.target_audience as { gender?: string; age?: string[] } | undefined;

  const [targetQuery, setTargetQuery] = useState((iv?.target_query as string) ?? '');
  const [keywords, setKeywords] = useState((iv?.keywords as string) ?? '');
  const [intent, setIntent] = useState((iv?.intent as string) ?? 'informational');
  const [charCount, setCharCount] = useState((iv?.target_char_count as number) ?? 8000);
  const [imageCount, setImageCount] = useState((iv?.image_count as number) ?? 0);

  const [tone, setTone] = useState(ivToneDisplay ?? (ivIsCustomTone ? '' : 'Экспертный'));
  const [customTone, setCustomTone] = useState(ivIsCustomTone ? ivToneRaw : '');
  const [showCustomTone, setShowCustomTone] = useState(ivIsCustomTone);
  const [gender, setGender] = useState(genderRevMap[ta?.gender ?? ''] ?? 'Все');
  const [ages, setAges] = useState<string[]>(ta?.age?.map(a => ageRevMap[a] ?? a) ?? ['Все']);
  const [geo, setGeo] = useState((iv?.geo_location as string) ?? '');
  const [imageStyles, setImageStyles] = useState<string[]>(
    (iv?.image_style as string[])?.map(s => styleRevMap[s] ?? s) ?? ['Реалистичные']
  );

  const [geoFocused, setGeoFocused] = useState(false);

  const [accordionOpen, setAccordionOpen] = useState(
    !!iv && Object.keys(iv).length > 0 &&
    !!(iv.brand || iv.cta || iv.forbidden_words || iv.legal_restrictions || iv.author_name)
  );
  const [faqEnabled, setFaqEnabled] = useState(iv?.faq_count !== undefined ? (iv.faq_count as number) > 0 : true);
  const [faqCount, setFaqCount] = useState(() => {
    const ivFaq = (iv?.faq_count as number) ?? 0;
    const maxForChars = Math.min(10, Math.max(2, Math.floor(((iv?.target_char_count as number) ?? 8000) / 2000)));
    return ivFaq > 0 ? Math.min(ivFaq, maxForChars) : Math.min(5, maxForChars);
  });
  const [brand, setBrand] = useState((iv?.brand as string) ?? '');
  const [brandUrl, setBrandUrl] = useState((iv?.brand_url as string) ?? '');
  const [brandDescription, setBrandDescription] = useState((iv?.brand_description as string) ?? '');
  const [cta, setCta] = useState((iv?.cta as string) ?? '');
  const [ctaUrl, setCtaUrl] = useState((iv?.cta_url as string) ?? '');
  const [externalLinks, setExternalLinks] = useState<Array<{url: string; anchor: string}>>(
    (iv?.external_links as Array<{url: string; anchor: string}>) ?? [{ url: '', anchor: '' }]
  );
  const [forbiddenWords, setForbiddenWords] = useState((iv?.forbidden_words as string) ?? '');
  const [legalRestrictions, setLegalRestrictions] = useState((iv?.legal_restrictions as string) ?? '');
  const [authorName, setAuthorName] = useState((iv?.author_name as string) ?? '');
  const [authorPosition, setAuthorPosition] = useState((iv?.author_position as string) ?? '');
  const [authorCompany, setAuthorCompany] = useState((iv?.author_company as string) ?? '');
  const [authorUrl, setAuthorUrl] = useState((iv?.author_url as string) ?? '');
  const [publicationDate, setPublicationDate] = useState((iv?.publication_date as string) ?? '');
  const [useTodayDate, setUseTodayDate] = useState(false);

  const [filterWarning, setFilterWarning] = useState(false);

  const maxImages = useMemo(() => getMaxImages(charCount), [charCount]);
  const maxLinks = charCount <= 5000 ? 2 : charCount <= 10000 ? 3 : charCount <= 15000 ? 4 : 5;
  const maxFaq = Math.min(10, Math.max(2, Math.floor(charCount / 2000)));

  const price = useMemo(
    () => calculatePriceClient(charCount, imageCount, faqEnabled ? faqCount : 0, pricingConfig),
    [charCount, imageCount, faqCount, faqEnabled, pricingConfig],
  );

  const geoSuggestions = useMemo(() => {
    if (!geoFocused) return [];
    return searchGeo(geo, 7);
  }, [geo, geoFocused]);

  const canSubmit =
    targetQuery.trim().length >= 3 &&
    keywords.trim().length > 0 &&
    !filterWarning &&
    getUrlError(brandUrl) === null &&
    getUrlError(ctaUrl) === null &&
    externalLinks.every(l => getUrlError(l.url) === null) &&
    getUrlError(authorUrl) === null;

  const checkForbidden = useCallback((text: string) => {
    const allText = `${targetQuery} ${keywords} ${text}`;
    const result = frontFilterClient(allText);
    setFilterWarning(!result.clean);
  }, [targetQuery, keywords]);

  const handleCharChange = useCallback((v: number) => {
    setCharCount(v);
    const newMax = getMaxImages(v);
    if (imageCount > newMax) setImageCount(newMax);
    const newMaxFaq = Math.min(10, Math.max(2, Math.floor(v / 2000)));
    if (faqCount > newMaxFaq) setFaqCount(newMaxFaq);
  }, [imageCount, faqCount]);

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

  const updateExternalLink = useCallback((index: number, field: 'url' | 'anchor', value: string) => {
    setExternalLinks(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }, []);

  const removeExternalLink = useCallback((index: number) => {
    setExternalLinks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addExternalLink = useCallback(() => {
    setExternalLinks(prev => [...prev, { url: '', anchor: '' }]);
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
      faq_count: faqEnabled ? faqCount : 0,
      brand: brand || undefined,
      brand_url: brand && brandUrl ? brandUrl : undefined,
      brand_description: brand && brandDescription ? brandDescription : undefined,
      cta: cta || undefined,
      cta_url: cta && ctaUrl ? ctaUrl : undefined,
      external_links: externalLinks.filter(l => l.url && l.anchor).length > 0
        ? externalLinks.filter(l => l.url && l.anchor)
        : undefined,
      forbidden_words: forbiddenWords || undefined,
      legal_restrictions: legalRestrictions || undefined,
      author_name: authorName || undefined,
      author_position: authorPosition || undefined,
      author_company: authorCompany || undefined,
      author_url: authorUrl || undefined,
      publication_date: useTodayDate ? new Date().toLocaleDateString('ru-RU') : (publicationDate || undefined),
    });
  }, [canSubmit, targetQuery, keywords, intent, charCount, imageCount, tone, customTone, showCustomTone, gender, ages, geo, imageStyles, faqEnabled, faqCount, brand, brandUrl, brandDescription, cta, ctaUrl, externalLinks, forbiddenWords, legalRestrictions, authorName, authorPosition, authorCompany, authorUrl, publicationDate, useTodayDate, onSubmit]);

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

        <div className="relative">
          <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Гео</label>
          <input type="text" value={geo} onChange={e => setGeo(e.target.value)} placeholder="Москва, Санкт-Петербург, Новосибирск..."
            onFocus={() => setGeoFocused(true)}
            onBlur={() => setTimeout(() => setGeoFocused(false), 200)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--seo-input-placeholder)] outline-none transition-colors focus:border-[var(--seo-input-focus)]" />
          {geoSuggestions.length > 0 && geoFocused && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[220px] overflow-hidden overflow-y-auto rounded-[var(--radius-md)] border border-[var(--seo-card-border)] bg-white shadow-md">
              {geoSuggestions.map(city => {
                const q = geo.trim().toLowerCase();
                let content: React.ReactNode = city;
                if (q) {
                  const idx = city.toLowerCase().indexOf(q);
                  if (idx !== -1) {
                    content = (
                      <>
                        {city.slice(0, idx)}
                        <strong>{city.slice(idx, idx + q.length)}</strong>
                        {city.slice(idx + q.length)}
                      </>
                    );
                  }
                }
                return (
                  <button
                    key={city}
                    type="button"
                    onMouseDown={() => { setGeo(city); setGeoFocused(false); }}
                    className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[#F5F5F5]"
                  >{content}</button>
                );
              })}
            </div>
          )}
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Город или регион. Пустое — вся Россия</div>
        </div>
      </div>

      {/* ДОПОЛНИТЕЛЬНЫЕ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-5">
        <button onClick={() => setAccordionOpen(v => !v)} className="flex w-full items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Дополнительные настройки</span>
          <span className="rounded bg-[#F5F5F5] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">13 полей {accordionOpen ? '▴' : '▾'}</span>
        </button>
        {accordionOpen && (
          <div className="mt-4 space-y-4">
            {/* Автор статьи */}
            <div className="rounded-[var(--radius-md)] border border-[var(--seo-card-border)] bg-[#FAFAFA] p-4">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Автор статьи (E-E-A-T)</div>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="mb-1 text-[12px] text-[var(--color-text-secondary)]">ФИО автора</label>
                  <input type="text" value={authorName} onChange={e => setAuthorName(e.target.value)} maxLength={100} placeholder="Иванов Алексей Петрович"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                </div>
                <div className="flex-1">
                  <label className="mb-1 text-[12px] text-[var(--color-text-secondary)]">Должность</label>
                  <input type="text" value={authorPosition} onChange={e => setAuthorPosition(e.target.value)} maxLength={100} placeholder="SEO-специалист"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                </div>
              </div>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="mb-1 text-[12px] text-[var(--color-text-secondary)]">Компания</label>
                  <input type="text" value={authorCompany} onChange={e => setAuthorCompany(e.target.value)} maxLength={100} placeholder="Digital Agency"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                </div>
                <div className="flex-1">
                  <label className="mb-1 text-[12px] text-[var(--color-text-secondary)]">Ссылка на профиль</label>
                  <input type="url" value={authorUrl} onChange={e => setAuthorUrl(e.target.value)} onBlur={() => setAuthorUrl(v => formatUrlInput(v))} placeholder="https://linkedin.com/in/..."
                    disabled={!authorName}
                    className={`w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)] ${!authorName ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  {getUrlError(authorUrl) && <div className="mt-0.5 text-[11px] text-[#DC2626]">{getUrlError(authorUrl)}</div>}
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="max-w-[200px]">
                  <label className="mb-1 text-[12px] text-[var(--color-text-secondary)]">Дата публикации</label>
                  <input type="text" value={useTodayDate ? new Date().toLocaleDateString('ru-RU') : publicationDate}
                    onChange={e => setPublicationDate(e.target.value)} maxLength={20} placeholder="28.03.2026"
                    disabled={useTodayDate}
                    className={`w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)] ${useTodayDate ? 'opacity-50 cursor-not-allowed' : ''}`} />
                </div>
                <label className="flex items-center gap-1.5 pb-[9px] cursor-pointer">
                  <input type="checkbox" checked={useTodayDate} onChange={e => { setUseTodayDate(e.target.checked); if (e.target.checked) setPublicationDate(''); }}
                    className="accent-[var(--color-accent)]" />
                  <span className="text-[12px] text-[var(--color-text-secondary)]">Сегодня</span>
                </label>
              </div>
              <div className="mt-2 text-[11px] text-[var(--color-text-secondary)]">Если заполнено — блок автора появится в статье. Улучшает E-E-A-T сигналы для Google.</div>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-primary)] cursor-pointer">
                <input type="checkbox" checked={faqEnabled} onChange={e => { setFaqEnabled(e.target.checked); if (e.target.checked && faqCount > maxFaq) setFaqCount(maxFaq); }}
                  className="accent-[var(--color-accent)]" />
                Включить FAQ-блок
              </label>
              {faqEnabled && (
                <>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={maxFaq} step={1} value={faqCount} onChange={e => setFaqCount(Number(e.target.value))}
                      className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--seo-card-border)] accent-[var(--color-accent)] outline-none" />
                    <span className="min-w-[24px] text-right text-sm font-medium">{faqCount}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Макс: {maxFaq} для {charCount.toLocaleString('ru-RU')} символов</div>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Бренд</label>
                <input type="text" value={brand} onChange={e => setBrand(e.target.value)} maxLength={100} placeholder="Старбакс"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Пусто → без упоминания</div>
              </div>
              <div className="flex-1">
                <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Ссылка на бренд</label>
                <input type="url" value={brandUrl} onChange={e => setBrandUrl(e.target.value)} onBlur={() => setBrandUrl(v => formatUrlInput(v))} placeholder="https://brand.ru" disabled={!brand}
                  className={`w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)] ${!brand ? 'opacity-50 cursor-not-allowed' : ''}`} />
                {getUrlError(brandUrl) && <div className="mt-0.5 text-[11px] text-[#DC2626]">{getUrlError(brandUrl)}</div>}
                <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Станет анкором бренда в тексте</div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">О компании</label>
              <textarea value={brandDescription} onChange={e => setBrandDescription(e.target.value)} maxLength={300} rows={2} placeholder="Интернет-магазин кофемашин с доставкой по России" disabled={!brand}
                className={`w-full resize-none rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)] ${!brand ? 'opacity-50 cursor-not-allowed' : ''}`} />
              <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Помогает органично встроить бренд в текст</div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">CTA в конце статьи</label>
                <textarea value={cta} onChange={e => setCta(e.target.value)} maxLength={500} rows={2} placeholder="Подберите кофемашину в нашем каталоге →"
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Пусто → без CTA-блока</div>
              </div>
              <div className="flex-1">
                <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Ссылка в CTA</label>
                <input type="url" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} onBlur={() => setCtaUrl(v => formatUrlInput(v))} placeholder="https://site.ru/catalog" disabled={!cta}
                  className={`w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)] ${!cta ? 'opacity-50 cursor-not-allowed' : ''}`} />
                {getUrlError(ctaUrl) && <div className="mt-0.5 text-[11px] text-[#DC2626]">{getUrlError(ctaUrl)}</div>}
                <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Станет ссылкой в CTA-блоке</div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-primary)]">
                Ссылки на источники
                <span className="rounded bg-[#F5F5F5] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">(макс {maxLinks})</span>
              </label>
              <div className="space-y-2">
                {externalLinks.map((link, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-2 gap-3">
                      <div>
                        <input type="url" value={link.url} onChange={e => updateExternalLink(i, 'url', e.target.value)} onBlur={() => updateExternalLink(i, 'url', formatUrlInput(link.url))} placeholder="https://site.ru/page"
                          className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                        {getUrlError(link.url) && <div className="mt-0.5 text-[11px] text-[#DC2626]">{getUrlError(link.url)}</div>}
                      </div>
                      <input type="text" value={link.anchor} onChange={e => updateExternalLink(i, 'anchor', e.target.value)} placeholder="текст ссылки" disabled={!link.url}
                        className={`w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)] ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </div>
                    {externalLinks.length > 1 && (
                      <button type="button" onClick={() => removeExternalLink(i)}
                        className="mt-1.5 cursor-pointer text-lg leading-none text-[var(--color-text-secondary)] hover:text-[#DC2626]">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addExternalLink}
                disabled={externalLinks.length >= maxLinks || !(externalLinks[externalLinks.length - 1]?.url && externalLinks[externalLinks.length - 1]?.anchor)}
                className={`mt-2 cursor-pointer text-[13px] ${
                  externalLinks.length >= maxLinks || !(externalLinks[externalLinks.length - 1]?.url && externalLinks[externalLinks.length - 1]?.anchor)
                    ? 'text-[var(--color-text-secondary)] opacity-50 !cursor-not-allowed'
                    : 'text-[var(--color-accent)] hover:underline'
                }`}
              >+ Добавить ссылку</button>
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
