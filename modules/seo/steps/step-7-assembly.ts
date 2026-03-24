// modules/seo/steps/step-7-assembly.ts — сборка HTML + .docx + метаданные + панель качества
import type { StepResult, PipelineContext, QualityMetrics } from '../types';
import type { ToolConfig } from '@/core/types';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { getStepModel } from '../config';
import { detectAIByCode } from '@/adapters/ai-detection';

/**
 * Пересчёт ключевых метрик качества по финальному тексту.
 * Повторяет логику step-4-seo-audit, но облегчённо.
 */
function recalculateMetrics(html: string, input: Record<string, unknown>): Partial<QualityMetrics> {
  const text = html.replace(/<[^>]*>/g, '');
  const textLower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const waterWords = new Set([
    'также', 'кроме', 'более', 'менее', 'очень', 'достаточно', 'довольно',
    'весьма', 'вполне', 'просто', 'именно', 'даже', 'уже', 'ещё', 'еще',
    'только', 'лишь', 'вообще', 'конечно', 'безусловно', 'разумеется',
    'несомненно', 'естественно', 'действительно', 'возможно', 'вероятно',
    'является', 'являются', 'данный', 'данная', 'данное', 'данные',
    'осуществлять', 'обеспечивать', 'представляет', 'абсолютно',
    'совершенно', 'полностью', 'максимально', 'крайне',
  ]);
  let waterCount = 0;
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^а-яёa-z]/g, '');
    if (waterWords.has(wl)) waterCount++;
  }
  const water = wordCount > 0 ? Math.round((waterCount / wordCount) * 100) : 0;

  const targetQuery = ((input.target_query as string) ?? '').toLowerCase();
  const keywordTokens = new Set<string>();
  for (const tok of targetQuery.split(/\s+/)) {
    const clean = tok.replace(/[^а-яёa-z]/g, '');
    if (clean.length > 0) keywordTokens.add(clean);
  }
  const kwStr = ((input.keywords as string) ?? '').toLowerCase();
  for (const tok of kwStr.split(/[\n\s]+/)) {
    const clean = tok.replace(/[^а-яёa-z]/g, '');
    if (clean.length > 0) keywordTokens.add(clean);
  }
  const wordFreq: Record<string, number> = {};
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^а-яёa-z]/g, '');
    if (wl.length > 3 && !keywordTokens.has(wl)) wordFreq[wl] = (wordFreq[wl] ?? 0) + 1;
  }
  const totalSig = Object.values(wordFreq).reduce((a, b) => a + b, 0);
  const repeated = Object.values(wordFreq).filter(c => c > 2).reduce((a, b) => a + b, 0);
  const spam = totalSig > 0 ? Math.round((repeated / totalSig) * 100) : 0;

  const wordFreqFull: Record<string, number> = {};
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^а-яёa-z]/g, '');
    if (wl.length > 3) wordFreqFull[wl] = (wordFreqFull[wl] ?? 0) + 1;
  }
  const maxFreq = Object.values(wordFreqFull).reduce((a, b) => Math.max(a, b), 0);
  const nausea_classic = Math.round(Math.sqrt(maxFreq) * 10) / 10;
  const totalSigFull = Object.values(wordFreqFull).reduce((a, b) => a + b, 0);
  const nausea_academic = totalSigFull > 0
    ? Math.round((maxFreq / totalSigFull) * 1000) / 10 : 0;

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const sentLengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const avgSentLen = sentLengths.length > 0
    ? sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length : 0;
  const longSentRatio = sentLengths.length > 0
    ? sentLengths.filter(l => l > 25).length / sentLengths.length : 0;
  const complexWordRatio = wordCount > 0
    ? words.filter(w => (w.toLowerCase().match(/[аеёиоуыэюяaeiouy]/g) ?? []).length > 4).length / wordCount : 0;
  const stopHits = [
    'в настоящее время', 'стоит отметить', 'как известно',
    'на сегодняшний день', 'важно отметить', 'следует подчеркнуть',
    'необходимо учитывать', 'таким образом',
  ].filter(sc => textLower.includes(sc)).length;
  let readability = 10
    - (avgSentLen > 18 ? (avgSentLen - 18) * 0.15 : 0)
    - (longSentRatio * 3)
    - (complexWordRatio * 2)
    - (stopHits * 0.5)
    - (water > 20 ? 1 : 0);
  readability = Math.max(1, Math.min(10, Math.round(readability * 10) / 10));

  const uniqueWords = Object.keys(wordFreqFull).length;
  const uniqueness = wordCount > 0 ? Math.min(98, Math.round((uniqueWords / wordCount) * 200)) : 85;

  const h2s = (html.match(/<h2[\s>]/gi) ?? []).length;
  const h3s = (html.match(/<h3[\s>]/gi) ?? []).length;
  const imgs = (html.match(/<img[\s>]/gi) ?? []).length;
  const faqSection = html.match(/<h2[^>]*>.*?(?:FAQ|часто задаваемые|вопрос)[\s\S]*?(?=<h2[\s>]|$)/i);
  const faqH3Count = faqSection ? (faqSection[0].match(/<h3[\s>]/gi) ?? []).length : 0;

  return {
    water,
    spam,
    nausea_classic,
    nausea_academic,
    uniqueness,
    readability,
    char_count: text.length,
    word_count: wordCount,
    h2_count: h2s,
    h3_count: h3s,
    image_count: imgs,
    faq_count: faqH3Count,
  };
}

/**
 * Шаг 7: финальная сборка.
 * 7.1 — Мета-теги (title, description, slug)
 * 7.2 — Schema JSON-LD
 * 7.3 — HTML с inline-стилями
 * 7.4 — .docx (TODO: реализация с библиотекой docx)
 * 7.5 — Именование файлов
 */
export async function executeAssembly(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const imagesData = ctx.data.images as Record<string, unknown>
    ?? ctx.data.step_6 as Record<string, unknown>
    ?? {};
  const revisionsData = ctx.data.ai_detect_revisions as Record<string, unknown>
    ?? ctx.data.step_5 as Record<string, unknown>
    ?? {};

  const articleHtml = (imagesData.article_html as string)
    ?? (revisionsData.article_html as string)
    ?? '';

  const altTexts = (imagesData.alt_texts as string[]) ?? [];
  const warnings = [
    ...((imagesData.warnings as string[]) ?? []),
    ...((revisionsData.warnings as string[]) ?? []),
  ];

  const auditData = ctx.data.seo_audit as Record<string, unknown>
    ?? ctx.data.step_4 as Record<string, unknown>
    ?? {};
  const baseMetrics = (auditData.qualityMetrics as QualityMetrics) ?? {} as QualityMetrics;
  const revMetrics = (revisionsData.qualityMetrics as QualityMetrics) ?? {} as QualityMetrics;

  const input = ctx.input;

  // Пересчитать метрики по финальному тексту
  const freshMetrics = recalculateMetrics(articleHtml, input);

  // Кодовый AI-чекер
  const plainTextForAI = articleHtml.replace(/<[^>]*>/g, '');
  const codeAiResult = detectAIByCode(plainTextForAI);

  // ai_score: среднее между LLM-оценкой и кодовой проверкой (LLM весит больше)
  const llmAiScore = revMetrics.ai_score ?? baseMetrics.ai_score ?? 0;
  const combinedAiScore = Math.round(llmAiScore * 0.6 + codeAiResult.score * 0.4);

  const qualityMetrics: QualityMetrics = {
    ...baseMetrics,
    ...revMetrics,
    ...freshMetrics,
    ai_score: combinedAiScore,
  };

  if (codeAiResult.markers.length > 0) {
    for (const marker of codeAiResult.markers) {
      warnings.push(`[ai-code] ${marker}`);
    }
  }
  const targetQuery = (input.target_query as string) ?? '';
  const intent = (input.intent as string) ?? 'informational';
  const faqCount = (input.faq_count as number) ?? 0;
  const addDisclaimer = !!(ctx.data.moderation as Record<string, unknown>)?.add_disclaimer;
  const legalRestrictions = (input.legal_restrictions as string) ?? '';

  // 7.1 — Мета-теги
  const mainKeyword = targetQuery.length <= 30
    ? targetQuery
    : targetQuery.split(' ').slice(0, 4).join(' ');

  const h1Match = articleHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : targetQuery;

  const plainText = articleHtml.replace(/<[^>]*>/g, '');

  let title: string;
  let description: string;
  let slug: string = buildSlug(targetQuery, h1Text);

  try {
    const metaModel = getStepModel(
      ctx.config as ToolConfig | null,
      'assembly',
      'anthropic/claude-opus-4.6',
    );

    const raw = await generateText({
      model: metaModel,
      systemPrompt: [
        'Ты — SEO-специалист. Сгенерируй meta title, meta description и slug для статьи.',
        'Верни ТОЛЬКО JSON без markdown: {"title": "...", "description": "...", "slug": "..."}',
        '',
        'Правила для title:',
        '- 55-60 символов',
        '- Содержит основной ключ в первых 40 символах',
        '- Не обрезанное предложение',
        '- Привлекает клики',
        `- Текущий год: ${new Date().getFullYear()}. Если используешь год — только текущий, не прошлые.`,
        '',
        'Правила для description:',
        '- Строго 150-160 символов. Не короче 150 и не длиннее 160. Если получается короче — добавь полезную деталь.',
        '- Содержит основной ключ + 1 дополнительный',
        '- Законченное предложение',
        '- Улучшает seo',
        '',
        'Правила для slug (ЧПУ URL):',
        '- Транслитерация с русского на латиницу',
        '- Основной ключ в начале URL',
        '- 3-5 слов через дефис',
        '- 30-60 символов',
        '- Только строчные латинские буквы, цифры и дефисы',
        '- Без дубликатов слов',
        '- Без предлогов и союзов (и, в, на, с, по, для, от, из, к, за, о, у, до, при, а, но)',
        '- Вопросительные слова ОСТАВЛЯТЬ (что=chto, как=kak, где=gde, почему=pochemu, какой=kakoy)',
        '- Указательные слова ОСТАВЛЯТЬ (это=eto, такое=takoe, такой=takoy)',
        '- Если ключ содержит бренд/название — оно идёт первым',
        "- Пример: запрос 'poizon что это' -> slug 'poizon-chto-eto-obzor-platformy'",
        "- Пример: запрос 'как выбрать кофемашину для дома' -> slug 'kak-vybrat-kofemashinu-doma'",
        "- Пример: запрос 'лучшие ноутбуки 2025' -> slug 'luchshie-noutbuki-2025-reyting'",
      ].join('\n'),
      userMessage: [
        `H1: ${h1Text}`,
        `Основной ключ: ${mainKeyword}`,
        `Intent: ${intent}`,
        `Начало статьи: ${plainText.slice(0, 500)}`,
      ].join('\n'),
      temperature: 0.4,
      maxOutputTokens: 256,
    });

    const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned) as { title: string; description: string; slug: string };
    title = parsed.title;
    description = parsed.description;
    if (parsed.slug && isValidSlug(parsed.slug)) slug = parsed.slug;
  } catch {
    title = h1Text.length <= 60
      ? h1Text
      : h1Text.slice(0, 60).replace(/\s\S*$/, '').trimEnd();

    const sentences = plainText.match(/[^.!?]+[.!?]+/g) ?? [];
    description = '';
    for (const s of sentences) {
      const trimmed = s.trim();
      const candidate = description ? description + ' ' + trimmed : trimmed;
      if (candidate.length >= 150 && candidate.length <= 160) {
        description = candidate;
        break;
      }
      if (candidate.length > 160) {
        description = candidate.slice(0, 155).replace(/\s\S*$/, '').trimEnd();
        if (!/[.!?]$/.test(description)) description += '.';
        break;
      }
      description = candidate;
    }
    if (!description) {
      description = plainText.slice(0, 155).replace(/\s\S*$/, '').trimEnd();
      if (!/[.!?]$/.test(description)) description += '.';
    }
    if (description.length < 150) {
      description = `${mainKeyword}. ${description}`;
      if (description.length > 160) {
        description = description.slice(0, 155).replace(/\s\S*$/, '').trimEnd();
        if (!/[.!?]$/.test(description)) description += '.';
      }
    }
  }

  description = description.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Если description короче 150 — дополнить из текста
  if (description.length < 150) {
    const extraSentences = plainText.match(/[^.!?]+[.!?]+/g) ?? [];
    for (const s of extraSentences) {
      const candidate = description + ' ' + s.trim();
      if (candidate.length >= 150 && candidate.length <= 165) {
        description = candidate;
        break;
      }
      if (candidate.length > 165) break;
    }
  }

  // Breadcrumb: короткая версия title без года и лишних деталей
  let breadcrumb = title.replace(/\s*\d{4}\s*/g, '').trim();
  if (breadcrumb.length > 60) {
    breadcrumb = breadcrumb.slice(0, 57).replace(/\s\S*$/, '').trimEnd() + '...';
  }

  // 7.2 — Schema JSON-LD
  const schemas: Record<string, unknown>[] = [];

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: new Date().toISOString().split('T')[0],
    inLanguage: 'ru-RU',
    ...(altTexts.length > 0 && { image: altTexts.map(alt => ({ '@type': 'ImageObject', description: alt })) }),
    publisher: { '@type': 'Organization', name: (input.brand as string) || 'Publisher' },
    author: { '@type': 'Organization', name: (input.brand as string) || 'Publisher' },
  });

  if (faqCount > 0) {
    const faqQuestions = extractFAQ(articleHtml);
    if (faqQuestions.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqQuestions.map(q => ({
          '@type': 'Question',
          name: q.question,
          acceptedAnswer: { '@type': 'Answer', text: q.answer },
        })),
      });
    }
  }

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: '/' },
      { '@type': 'ListItem', position: 2, name: breadcrumb },
    ],
  });

  if (intent === 'educational') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: title,
      description,
    });
  }

  const jsonLd = schemas.map(s => JSON.stringify(s)).join('\n');

  // 7.3 — HTML с inline-стилями
  const brand = (input.brand as string) ?? '';
  const brandUrl = (input.brand_url as string) ?? '';
  const ctaUrl = (input.cta_url as string) ?? '';

  let processedHtml = articleHtml;
  if (brand && brandUrl) {
    processedHtml = ensureBrandLinks(processedHtml, brand, brandUrl);
  }
  if (ctaUrl) {
    processedHtml = ensureCtaLink(processedHtml, ctaUrl);
  }

  const styledHtml = wrapWithInlineStyles(processedHtml, addDisclaimer, legalRestrictions);

  // 7.5 — Именование файлов
  const fileBaseName = slug || transliterate(targetQuery);

  const faqSection = styledHtml.match(/<h2[^>]*>.*?(?:FAQ|часто задаваемые|вопрос)[\s\S]*?(?=<h2[\s>]|<\/article>|$)/i);
  const actualFaqCount = faqSection ? (faqSection[0].match(/<h3[\s>]/gi) ?? []).length : 0;

  const metadata = {
    title,
    description,
    slug,
    breadcrumb,
    alt_texts: altTexts,
    json_ld: jsonLd,
    actual_faq_count: actualFaqCount,
    file_name: `${fileBaseName}.docx`,
    metadata_file_name: `${fileBaseName}_metadannye.docx`,
  };

  return {
    success: true,
    data: {
      article_html: styledHtml,
      article_docx_base64: '', // TODO: генерация .docx с библиотекой docx
      metadata,
      qualityMetrics,
      warnings: [...new Set(warnings)],
      schemas,
    },
    durationMs: Date.now() - start,
  };
}

// --- Вспомогательные функции ---

function transliterate(text: string): string {
  const map: Record<string, string> = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
    'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
    'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
  };
  return text
    .toLowerCase()
    .split('')
    .map(c => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isValidSlug(slug: string): boolean {
  if (!slug || slug.length > 75) return false;
  if (/[а-яёА-ЯЁ]/.test(slug)) return false;
  if (/\s/.test(slug)) return false;
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug);
}

function buildSlug(query: string, h1Fallback?: string): string {
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'для', 'от', 'из', 'к', 'за', 'о', 'об',
    'у', 'до', 'при', 'а', 'но', 'же', 'бы', 'ли', 'или', 'ни',
  ]);

  const buildFromSource = (source: string) => {
    const words = source
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/gi, '')
      .split(/\s+/)
      .filter(w => w && !stopWords.has(w));

    const seen = new Set<string>();
    const result: string[] = [];
    for (const w of words) {
      const t = transliterate(w);
      if (seen.has(t)) continue;
      seen.add(t);
      result.push(t);
      if (result.length >= 5) break;
    }
    return result;
  };

  let unique = buildFromSource(query);
  if (unique.length < 2 && h1Fallback) {
    unique = buildFromSource(h1Fallback);
  }

  let slug = unique.join('-');
  if (slug.length > 75) {
    slug = slug.slice(0, 75).replace(/-[^-]*$/, '');
  }
  return slug;
}

function extractFAQ(html: string): Array<{ question: string; answer: string }> {
  const faqSection = html.match(/<h2[^>]*>.*(?:FAQ|часто задаваемые|вопрос)[\s\S]*?(?=<h2[\s>]|$)/i);
  if (!faqSection) return [];

  const questions: Array<{ question: string; answer: string }> = [];
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[\s>]|<h2[\s>]|$)/gi;
  let match;

  while ((match = h3Regex.exec(faqSection[0])) !== null) {
    const question = match[1].replace(/<[^>]*>/g, '').trim();
    const answer = match[2].replace(/<[^>]*>/g, '').trim();
    if (question && answer) {
      const cleanAnswer = answer.split(/\n{2,}/)[0].trim().slice(0, 300);
      if (cleanAnswer.length > 10) {
        questions.push({ question, answer: cleanAnswer });
      }
    }
  }

  return questions;
}

function ensureBrandLinks(html: string, brand: string, brandUrl: string): string {
  if (html.includes(brandUrl)) return html;

  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const textNodeRegex = new RegExp(`(>)([^<]*?)(${escapedBrand})([^<]*?)(<)`, 'gi');
  let match;
  while ((match = textNodeRegex.exec(html)) !== null) {
    const before = html.slice(0, match.index);
    if (/<a\b[^>]*>[^<]*$/i.test(before)) continue;
    if (/<h[1-3]\b[^>]*>[^<]*$/i.test(before)) continue;

    const after = html.slice(match.index + match[0].length);
    const link = `<a href="${brandUrl}" target="_blank" style="color:#2563EB;text-decoration:underline">${match[3]}</a>`;
    return `${before}${match[1]}${match[2]}${link}${match[4]}${match[5]}${after}`;
  }

  return html;
}

function ensureCtaLink(html: string, ctaUrl: string): string {
  if (html.includes(ctaUrl)) return html;

  let lastIdx = -1;
  let lastFullMatch = '';
  let lastInner = '';
  let lastPTag = '';
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(html)) !== null) {
    lastIdx = m.index;
    lastFullMatch = m[0];
    lastPTag = m[0].match(/<p[^>]*>/i)![0];
    lastInner = m[1];
  }

  if (lastIdx < 0 || !lastInner.trim()) return html;
  if (lastInner.includes('<a ')) return html;

  const linked = `${lastPTag}<a href="${ctaUrl}" target="_blank" style="color:#2563EB;text-decoration:underline">${lastInner.trim()}</a></p>`;
  return html.slice(0, lastIdx) + linked + html.slice(lastIdx + lastFullMatch.length);
}

function wrapWithInlineStyles(
  html: string,
  addDisclaimer: boolean,
  legalRestrictions: string,
): string {
  let styled = html
    .replace(/<h1([^>]*)>/gi, '<h1$1 style="font-size:28px;font-weight:700;margin:0 0 16px;line-height:1.3;color:#1a1a1a">')
    .replace(/<h2([^>]*)>/gi, '<h2$1 style="font-size:22px;font-weight:600;margin:24px 0 12px;line-height:1.3;color:#1a1a1a">')
    .replace(/<h3([^>]*)>/gi, '<h3$1 style="font-size:18px;font-weight:600;margin:20px 0 8px;line-height:1.3;color:#1a1a1a">')
    .replace(/<p([^>]*)>/gi, '<p$1 style="font-size:16px;line-height:1.7;margin:0 0 12px;color:#333">')
    .replace(/<figure([^>]*)>/gi, '<figure$1 style="margin:20px 0;text-align:center">')
    .replace(/<img([^>]*)>/gi, '<img$1 style="max-width:100%;height:auto;border-radius:8px">')
    .replace(/<a([^>]*)>/gi, '<a$1 style="color:#2563EB;text-decoration:underline">');

  if (addDisclaimer && legalRestrictions) {
    const disclaimer = `<p style="font-size:13px;line-height:1.5;color:#666;padding:12px;background:#f9f9f9;border-radius:6px;margin:16px 0"><em>Дисклеймер: ${legalRestrictions}</em></p>`;
    const lastPIdx = styled.lastIndexOf('<p');
    if (lastPIdx > 0) {
      styled = styled.slice(0, lastPIdx) + disclaimer + styled.slice(lastPIdx);
    } else {
      styled += disclaimer;
    }
  }

  return `<article style="font-family:Inter,system-ui,sans-serif;max-width:800px">${styled}</article>`;
}
