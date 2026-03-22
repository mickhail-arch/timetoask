// modules/seo/steps/step-7-assembly.ts — сборка HTML + .docx + метаданные + панель качества
import type { StepResult, PipelineContext, QualityMetrics } from '../types';
import type { ToolConfig } from '@/core/types';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { getStepModel } from '../config';

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
  const qualityMetrics: QualityMetrics = { ...baseMetrics, ...revMetrics };

  const input = ctx.input;
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

  try {
    const metaModel = getStepModel(
      ctx.config as ToolConfig | null,
      'assembly',
      'google/gemini-2.5-flash',
    );

    const raw = await generateText({
      model: metaModel,
      systemPrompt: [
        'Ты — SEO-специалист. Сгенерируй meta title и meta description для статьи.',
        'Верни ТОЛЬКО JSON без markdown: {"title": "...", "description": "..."}',
        '',
        'Правила для title:',
        '- 55-60 символов',
        '- Содержит основной ключ в первых 40 символах',
        '- Не обрезанное предложение',
        '- Привлекает клики',
        '',
        'Правила для description:',
        '- 150-160 символов строго',
        '- Содержит основной ключ + 1 дополнительный',
        '- Законченное предложение',
        '- Улучшает seo',
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
    const parsed = JSON.parse(cleaned) as { title: string; description: string };
    title = parsed.title;
    description = parsed.description;
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

  const slug = buildSlug(targetQuery);
  const breadcrumb = title;

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
  const styledHtml = wrapWithInlineStyles(articleHtml, addDisclaimer, legalRestrictions);

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
      warnings,
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

function buildSlug(query: string): string {
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'для', 'от', 'из', 'к', 'за', 'о', 'об',
    'у', 'до', 'при', 'не', 'что', 'как', 'это', 'все', 'или', 'но',
    'а', 'же', 'ли', 'бы', 'то', 'так', 'уже', 'ещё', 'еще',
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .split(/\s+/)
    .filter(w => w && !stopWords.has(w));

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const w of words) {
    const t = transliterate(w);
    if (seen.has(t)) continue;
    seen.add(t);
    unique.push(t);
    if (unique.length >= 5) break;
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
      questions.push({ question, answer: answer.slice(0, 500) });
    }
  }

  return questions;
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
    .replace(/<img([^>]*)>/gi, '<img$1 style="max-width:100%;height:auto;border-radius:8px">');

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
