// modules/seo/steps/step-7-assembly.ts — сборка HTML + .docx + метаданные + панель качества
import type { StepResult, PipelineContext, QualityMetrics } from '../types';

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
  const title = h1Text.length <= 60 ? h1Text : h1Text.slice(0, 57) + '...';

  const plainText = articleHtml.replace(/<[^>]*>/g, '');
  const firstSentences = plainText.split(/[.!?]/).filter(s => s.trim().length > 10).slice(0, 2).join('. ').trim();
  let description = firstSentences.length > 160
    ? firstSentences.slice(0, 157) + '...'
    : firstSentences + '.';
  if (description.length < 140) {
    description = `${mainKeyword}. ${description}`;
  }

  const slug = transliterate(h1Text).slice(0, 60);
  const breadcrumb = targetQuery.split(' ').slice(0, 5).join(' ');

  // 7.2 — Schema JSON-LD
  const schemas: Record<string, unknown>[] = [];

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: new Date().toISOString().split('T')[0],
    inLanguage: 'ru-RU',
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
  const fileBaseName = transliterate(targetQuery);

  const metadata = {
    title,
    description,
    slug,
    breadcrumb,
    alt_texts: altTexts,
    json_ld: jsonLd,
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
    .replace(/^-|-$/g, '')
    .slice(0, 60);
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
      questions.push({ question, answer });
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
