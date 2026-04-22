'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { calculatePriceClient } from '@/lib/seo-article/price-calculator';
import type { PricingConfig } from '@/lib/seo-article/price-calculator';
import { frontFilterClient } from '@/lib/seo-article/front-filter';
import { searchGeo } from '@/core/constants';
import { formatUrlInput, getUrlError } from '@/core/utils';
import '@/components/seo-article/tokens.css';

const MAX_IMAGES: Record<number, number> = {
  6000:3, 7000:4, 8000:5, 9000:5, 10000:6,
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
  onQueryChange?: (query: string) => void;
}

export function ScreenInput({ onSubmit, pricingConfig, initialValues, onQueryChange }: ScreenInputProps) {
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
  const [charCount, setCharCount] = useState(Math.max(6000, (iv?.target_char_count as number) ?? 8000));
  const [imageCount, setImageCount] = useState((iv?.image_count as number) ?? 0);
  const [aiModel, setAiModel] = useState<'gemini' | 'sonnet' | 'opus47'>((iv?.ai_model as 'gemini' | 'sonnet' | 'opus47') ?? 'opus47');

  const [tone, setTone] = useState(ivToneDisplay ?? (ivIsCustomTone ? '' : 'Экспертный'));
  const [customTone, setCustomTone] = useState(ivIsCustomTone ? ivToneRaw : '');
  const [showCustomTone, setShowCustomTone] = useState(ivIsCustomTone);
  const [toneComment, setToneComment] = useState((iv?.tone_comment as string) ?? '');
  const [gender, setGender] = useState(genderRevMap[ta?.gender ?? ''] ?? 'Все');
  const [ages, setAges] = useState<string[]>(ta?.age?.map(a => ageRevMap[a] ?? a) ?? ['Все']);
  const [geo, setGeo] = useState((iv?.geo_location as string) ?? '');
  const [imageStyles, setImageStyles] = useState<string[]>(
    (iv?.image_style as string[])?.map(s => styleRevMap[s] ?? s) ?? ['Реалистичные']
  );

  const [geoFocused, setGeoFocused] = useState(false);

  const [accordionOpen, setAccordionOpen] = useState(
    !!iv && Object.keys(iv).length > 0 &&
    !!(iv.brand || iv.cta || iv.forbidden_words || iv.legal_restrictions || iv.author_name || iv.comparison_enabled)
  );
  const [faqEnabled, setFaqEnabled] = useState(iv?.faq_count !== undefined ? (iv.faq_count as number) > 0 : true);
  const [faqCount, setFaqCount] = useState(() => {
    const ivFaq = (iv?.faq_count as number) ?? 0;
    const maxForChars = Math.min(10, Math.max(2, Math.floor(((iv?.target_char_count as number) ?? 8000) / 2000)));
    return ivFaq > 0 ? Math.min(ivFaq, maxForChars) : Math.min(5, maxForChars);
  });
  const [comparisonEnabled, setComparisonEnabled] = useState((iv?.comparison_enabled as boolean) ?? false);
  const [comparisonObjects, setComparisonObjects] = useState((iv?.comparison_objects as number) ?? 3);
  const [comparisonCriteria, setComparisonCriteria] = useState((iv?.comparison_criteria as number) ?? 3);
  const [analysisModel, setAnalysisModel] = useState<'sonnet' | 'opus47'>((iv?.analysis_model as 'sonnet' | 'opus47') ?? 'sonnet');

  const comparisonAllowed = charCount >= 8000;

  const comparisonLimits = useMemo(() => {
    if (charCount <= 9000) return { maxObjects: 2, maxCriteria: 3 };
    if (charCount <= 12000) return { maxObjects: 3, maxCriteria: 4 };
    if (charCount <= 16000) return { maxObjects: 4, maxCriteria: 4 };
    return { maxObjects: 5, maxCriteria: 5 };
  }, [charCount]);

  useEffect(() => {
    if (!comparisonAllowed && comparisonEnabled) {
      setComparisonEnabled(false);
    }
    if (comparisonObjects > comparisonLimits.maxObjects) {
      setComparisonObjects(comparisonLimits.maxObjects);
    }
    if (comparisonCriteria > comparisonLimits.maxCriteria) {
      setComparisonCriteria(comparisonLimits.maxCriteria);
    }
  }, [charCount, comparisonAllowed, comparisonLimits]); // eslint-disable-line react-hooks/exhaustive-deps
  const [brand, setBrand] = useState((iv?.brand as string) ?? '');
  const [brandUrl, setBrandUrl] = useState((iv?.brand_url as string) ?? '');
  const [brandDescription, setBrandDescription] = useState((iv?.brand_description as string) ?? '');
  const [cta, setCta] = useState((iv?.cta as string) ?? '');
  const [ctaUrl, setCtaUrl] = useState((iv?.cta_url as string) ?? '');
  const [internalLinks, setInternalLinks] = useState<Array<{url: string; anchor: string}>>(
    (iv?.internal_links as Array<{url: string; anchor: string}>) ?? (iv?.external_links as Array<{url: string; anchor: string}>) ?? [{ url: '', anchor: '' }]
  );
  const [sourceLinks, setSourceLinks] = useState<Array<{url: string; anchor: string}>>(
    (iv?.source_links as Array<{url: string; anchor: string}>) ?? [{ url: '', anchor: '' }]
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
  const maxTotalLinks = Math.floor(charCount / 2000);
  const brandLinkCount = brand && brandUrl ? 1 : 0;
  const remainingLinks = maxTotalLinks - brandLinkCount;
  const maxInternalLinks = Math.min(5, Math.max(1, Math.ceil(remainingLinks * 0.6)));
  const maxSourceLinks = Math.min(5, Math.max(1, remainingLinks - maxInternalLinks));
  const maxFaq = Math.min(10, Math.max(2, Math.floor(charCount / 2000)));

  const price = useMemo(
    () => calculatePriceClient(charCount, imageCount, faqEnabled ? faqCount : 0, pricingConfig, aiModel, analysisModel),
    [charCount, imageCount, faqCount, faqEnabled, pricingConfig, aiModel, analysisModel],
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
    internalLinks.every(l => getUrlError(l.url) === null) &&
    sourceLinks.every(l => getUrlError(l.url) === null) &&
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

  const updateInternalLink = useCallback((index: number, field: 'url' | 'anchor', value: string) => {
    setInternalLinks(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }, []);

  const removeInternalLink = useCallback((index: number) => {
    setInternalLinks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addInternalLink = useCallback(() => {
    setInternalLinks(prev => [...prev, { url: '', anchor: '' }]);
  }, []);

  const updateSourceLink = useCallback((index: number, field: 'url' | 'anchor', value: string) => {
    setSourceLinks(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }, []);

  const removeSourceLink = useCallback((index: number) => {
    setSourceLinks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addSourceLink = useCallback(() => {
    setSourceLinks(prev => [...prev, { url: '', anchor: '' }]);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit({
      target_query: targetQuery.trim(),
      keywords: keywords.trim(),
      intent,
      ai_model: aiModel,
      target_char_count: charCount,
      image_count: imageCount,
      tone_of_voice: showCustomTone ? customTone : (() => {
        const map: Record<string, string> = { 'Экспертный': 'expert', 'Разговорный': 'casual', 'Деловой': 'business', 'Продающий': 'sales', 'Научный': 'scientific', 'Простой': 'simple' };
        return map[tone] ?? tone.toLowerCase();
      })(),
      tone_comment: toneComment || undefined,
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
      comparison_enabled: comparisonEnabled,
      comparison_objects: comparisonEnabled ? comparisonObjects : undefined,
      comparison_criteria: comparisonEnabled ? comparisonCriteria : undefined,
      analysis_model: analysisModel,
      brand: brand || undefined,
      brand_url: brand && brandUrl ? brandUrl : undefined,
      brand_description: brand && brandDescription ? brandDescription : undefined,
      cta: cta || undefined,
      cta_url: cta && ctaUrl ? ctaUrl : undefined,
      internal_links: internalLinks.filter(l => l.url && l.anchor).length > 0
        ? internalLinks.filter(l => l.url && l.anchor)
        : undefined,
      source_links: sourceLinks.filter(l => l.url && l.anchor).length > 0
        ? sourceLinks.filter(l => l.url && l.anchor)
        : undefined,
      forbidden_words: forbiddenWords || undefined,
      legal_restrictions: legalRestrictions || undefined,
      author_name: authorName || undefined,
      author_position: authorPosition || undefined,
      author_company: authorCompany || undefined,
      author_url: authorUrl || undefined,
      publication_date: useTodayDate ? new Date().toLocaleDateString('ru-RU') : (publicationDate || undefined),
    });
  }, [canSubmit, targetQuery, keywords, intent, aiModel, charCount, imageCount, tone, customTone, showCustomTone, toneComment, gender, ages, geo, imageStyles, faqEnabled, faqCount, comparisonEnabled, comparisonObjects, comparisonCriteria, analysisModel, brand, brandUrl, brandDescription, cta, ctaUrl, internalLinks, sourceLinks, forbiddenWords, legalRestrictions, authorName, authorPosition, authorCompany, authorUrl, publicationDate, useTodayDate, onSubmit]);

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
            onChange={e => { setTargetQuery(e.target.value); checkForbidden(e.target.value); onQueryChange?.(e.target.value); }}
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

        <div className="mt-4">
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-primary)]">Модель AI</label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setAiModel('gemini')}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all ${aiModel === 'gemini' ? 'border-[var(--color-accent)] bg-white' : 'border-[var(--seo-input-border)] bg-white hover:border-[var(--color-text-secondary)]'}`}>
              <div className="text-[13px] font-medium text-[var(--color-text-primary)]">Gemini 3.1 Pro</div>
              <div className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">Самая быстрая и дешёвая</div>
            </button>
            <button type="button" onClick={() => setAiModel('sonnet')}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all ${aiModel === 'sonnet' ? 'border-[var(--color-accent)] bg-white' : 'border-[var(--seo-input-border)] bg-white hover:border-[var(--color-text-secondary)]'}`}>
              <div className="text-[13px] font-medium text-[var(--color-text-primary)]">Sonnet 4.6</div>
              <div className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">Баланс цены и качества</div>
            </button>
            <button type="button" onClick={() => setAiModel('opus47')}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all ${aiModel === 'opus47' ? 'border-[var(--color-accent)] bg-white' : 'border-[var(--seo-input-border)] bg-white hover:border-[var(--color-text-secondary)]'}`}>
              <div className="text-[13px] font-medium text-[var(--color-text-primary)]">Opus 4.7</div>
              <div className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">Лучшее качество текста</div>
            </button>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Применяется только к основной генерации статьи</div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">Объём статьи</label>
          <div className="flex items-center gap-3">
            <input type="range" min={6000} max={20000} step={1000} value={charCount} onChange={e => handleCharChange(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--seo-card-border)] accent-[var(--color-accent)] outline-none" />
            <span className="min-w-[72px] text-right text-sm font-medium text-[var(--color-text-primary)]">{charCount.toLocaleString('ru-RU')} симв</span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">6 000 – 20 000 символов</div>
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
          <div className="mt-2">
            <textarea
              value={toneComment}
              onChange={e => setToneComment(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Пиши с юмором, как будто объясняешь другу..."
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]"
            />
            <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Необязательно. Дополнит выбранный стиль вашими пожеланиями
            </div>
          </div>
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

      {/* FAQ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-5">
        <div>
          <label className="mb-1.5 text-[13px] font-medium text-[var(--color-text-primary)]">FAQ</label>
          <label className="mb-1.5 flex items-center gap-2 text-[13px] text-[var(--color-text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={faqEnabled}
              onChange={e => {
                setFaqEnabled(e.target.checked);
                if (e.target.checked && faqCount < 2) setFaqCount(2);
                if (e.target.checked && faqCount > maxFaq) setFaqCount(maxFaq);
              }}
              className="accent-[var(--color-accent)]"
            />
            Включить FAQ-блок
          </label>
          {faqEnabled && (
            <>
              <div className="flex items-center gap-3">
                <input type="range" min={2} max={maxFaq} step={1} value={faqCount} onChange={e => setFaqCount(Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--seo-card-border)] accent-[var(--color-accent)] outline-none" />
                <span className="min-w-[24px] text-right text-sm font-medium">{faqCount}</span>
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">от 2 до {maxFaq} вопросов для {charCount.toLocaleString('ru-RU')} символов</div>
            </>
          )}
        </div>
      </div>

      {/* ДОПОЛНИТЕЛЬНЫЕ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--seo-card-border)] bg-[var(--seo-card-bg)] p-5">
        <button onClick={() => setAccordionOpen(v => !v)} className="flex w-full items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Дополнительные настройки</span>
          <span className="rounded bg-[#F5F5F5] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">14 полей {accordionOpen ? '▴' : '▾'}</span>
        </button>
        {accordionOpen && (
          <div className="mt-4 space-y-4">
            {/* Блок сравнения */}
            <div className="rounded-[var(--radius-md)] border border-[var(--seo-card-border)] bg-[#FAFAFA] p-4">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Блок сравнения</div>
              <label className="mb-1 flex items-center gap-2 text-[13px] text-[var(--color-text-primary)] cursor-pointer">
                <input type="checkbox" checked={comparisonEnabled} onChange={e => setComparisonEnabled(e.target.checked)} disabled={!comparisonAllowed} className="accent-[var(--color-accent)]" />
                Включить сравнительную таблицу
              </label>
              {!comparisonAllowed && (
                <div className="mb-2 text-[11px] text-[var(--color-text-secondary)]">Доступно от 8 000 символов</div>
              )}
              {comparisonEnabled && (
                <>
                  <div className="mt-3 flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 text-[12px] text-[var(--color-text-secondary)]">Объектов сравнения</label>
                      {comparisonLimits.maxObjects === 2 ? (
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">2</div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <input type="range" min={2} max={comparisonLimits.maxObjects} step={1} value={comparisonObjects} onChange={e => setComparisonObjects(Number(e.target.value))}
                            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--seo-card-border)] accent-[var(--color-accent)] outline-none" />
                          <span className="min-w-[24px] text-right text-sm font-medium">{comparisonObjects}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 text-[12px] text-[var(--color-text-secondary)]">Критериев</label>
                      {comparisonLimits.maxCriteria === 2 ? (
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">2</div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <input type="range" min={2} max={comparisonLimits.maxCriteria} step={1} value={comparisonCriteria} onChange={e => setComparisonCriteria(Number(e.target.value))}
                            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--seo-card-border)] accent-[var(--color-accent)] outline-none" />
                          <span className="min-w-[24px] text-right text-sm font-medium">{comparisonCriteria}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">от 2 до {comparisonLimits.maxObjects} объектов и до {comparisonLimits.maxCriteria} критериев для {charCount.toLocaleString('ru-RU')} символов</div>
                </>
              )}
            </div>
            {/* Модель анализа текста */}
            <div className="rounded-[var(--radius-md)] border border-[var(--seo-card-border)] bg-[#FAFAFA] p-4">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Модель анализа текста</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAnalysisModel('sonnet')}
                  className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all ${analysisModel === 'sonnet' ? 'border-[var(--color-accent)] bg-white' : 'border-[var(--seo-input-border)] bg-white hover:border-[var(--color-text-secondary)]'}`}>
                  <div className="text-[13px] font-medium text-[var(--color-text-primary)]">Sonnet 4.6</div>
                  <div className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">По умолчанию. Быстрый анализ</div>
                </button>
                <button type="button" onClick={() => setAnalysisModel('opus47')}
                  className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all ${analysisModel === 'opus47' ? 'border-[var(--color-accent)] bg-white' : 'border-[var(--seo-input-border)] bg-white hover:border-[var(--color-text-secondary)]'}`}>
                  <div className="text-[13px] font-medium text-[var(--color-text-primary)]">Opus 4.7</div>
                  <div className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">Глубокий анализ и правки</div>
                </button>
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Используется для SEO-аудита, AI-детекта и финальных правок</div>
            </div>
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
                Перелинковка
                <span className="rounded bg-[#F5F5F5] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">(макс {maxInternalLinks})</span>
              </label>
              <div className="mb-1 text-[11px] text-[var(--color-text-secondary)]">Ссылки на свои статьи и страницы</div>
              <div className="space-y-2">
                {internalLinks.map((link, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-2 gap-3">
                      <div>
                        <input type="url" value={link.url} onChange={e => updateInternalLink(i, 'url', e.target.value)} onBlur={() => updateInternalLink(i, 'url', formatUrlInput(link.url))} placeholder="https://site.ru/article"
                          className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                        {getUrlError(link.url) && <div className="mt-0.5 text-[11px] text-[#DC2626]">{getUrlError(link.url)}</div>}
                      </div>
                      <input type="text" value={link.anchor} onChange={e => updateInternalLink(i, 'anchor', e.target.value)} placeholder="анкор страницы" disabled={!link.url}
                        className={`w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)] ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </div>
                    {internalLinks.length > 1 && (
                      <button type="button" onClick={() => removeInternalLink(i)}
                        className="mt-1.5 cursor-pointer text-lg leading-none text-[var(--color-text-secondary)] hover:text-[#DC2626]">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addInternalLink}
                disabled={internalLinks.length >= maxInternalLinks || !(internalLinks[internalLinks.length - 1]?.url && internalLinks[internalLinks.length - 1]?.anchor)}
                className={`mt-2 cursor-pointer text-[13px] ${
                  internalLinks.length >= maxInternalLinks || !(internalLinks[internalLinks.length - 1]?.url && internalLinks[internalLinks.length - 1]?.anchor)
                    ? 'text-[var(--color-text-secondary)] opacity-50 !cursor-not-allowed'
                    : 'text-[var(--color-accent)] hover:underline'
                }`}
              >+ Добавить ссылку</button>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-primary)]">
                Ссылки на источники
                <span className="rounded bg-[#F5F5F5] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">(макс {maxSourceLinks})</span>
              </label>
              <div className="mb-1 text-[11px] text-[var(--color-text-secondary)]">Авторитетные внешние ресурсы для подтверждения фактов</div>
              <div className="space-y-2">
                {sourceLinks.map((link, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-2 gap-3">
                      <div>
                        <input type="url" value={link.url} onChange={e => updateSourceLink(i, 'url', e.target.value)} onBlur={() => updateSourceLink(i, 'url', formatUrlInput(link.url))} placeholder="https://source.ru/research"
                          className="w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)]" />
                        {getUrlError(link.url) && <div className="mt-0.5 text-[11px] text-[#DC2626]">{getUrlError(link.url)}</div>}
                      </div>
                      <input type="text" value={link.anchor} onChange={e => updateSourceLink(i, 'anchor', e.target.value)} placeholder="название источника" disabled={!link.url}
                        className={`w-full rounded-[var(--radius-md)] border border-[var(--seo-input-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--seo-input-focus)] ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </div>
                    {sourceLinks.length > 1 && (
                      <button type="button" onClick={() => removeSourceLink(i)}
                        className="mt-1.5 cursor-pointer text-lg leading-none text-[var(--color-text-secondary)] hover:text-[#DC2626]">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addSourceLink}
                disabled={sourceLinks.length >= maxSourceLinks || !(sourceLinks[sourceLinks.length - 1]?.url && sourceLinks[sourceLinks.length - 1]?.anchor)}
                className={`mt-2 cursor-pointer text-[13px] ${
                  sourceLinks.length >= maxSourceLinks || !(sourceLinks[sourceLinks.length - 1]?.url && sourceLinks[sourceLinks.length - 1]?.anchor)
                    ? 'text-[var(--color-text-secondary)] opacity-50 !cursor-not-allowed'
                    : 'text-[var(--color-accent)] hover:underline'
                }`}
              >+ Добавить ссылку</button>
              {(() => {
                const filledInternalLinks = internalLinks.filter(l => l.url && l.anchor).length;
                const filledSourceLinks = sourceLinks.filter(l => l.url && l.anchor).length;
                return (filledInternalLinks + filledSourceLinks + brandLinkCount > 0) && (
                  <div className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
                    Всего ссылок: {filledInternalLinks + filledSourceLinks + brandLinkCount} из {maxTotalLinks} (1 на 2000 символов)
                    {brandLinkCount > 0 && ' · включая бренд'}
                  </div>
                );
              })()}
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
            база {price.base.toLocaleString('ru-RU')} + объём {price.chars.toLocaleString('ru-RU')} + картинки {price.images.toLocaleString('ru-RU')} + FAQ {price.faq.toLocaleString('ru-RU')}
          </div>
        </div>
        <div className="text-[15px] font-medium">{price.total.toLocaleString('ru-RU')} ₽</div>
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
