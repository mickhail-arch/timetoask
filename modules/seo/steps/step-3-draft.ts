// modules/seo/steps/step-3-draft.ts — написание чистовика (один вызов Claude)
import type { StepResult, PipelineContext, BriefData } from '../types';
import { getStepModel } from '../config';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { systemPrompt } from '@/plugins/seo-article-express/prompt';
import type { ToolConfig } from '@/core/types';

export async function executeDraft(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const model = getStepModel(
    ctx.config as ToolConfig | null,
    'draft',
    'google/gemini-2.5-flash',
  );

  const brief = (ctx.data.confirmation as Record<string, unknown>)?.brief as BriefData
    ?? (ctx.data.brief as Record<string, unknown>)?.brief as BriefData;

  const input = ctx.input;
  const targetQuery = (input.target_query as string) ?? '';
  const keywords = (input.keywords as string) ?? '';
  const intent = (input.intent as string) ?? 'informational';
  const charCount = (input.target_char_count as number) ?? 8000;
  const imageCount = (input.image_count as number) ?? 0;
  const faqCount = (input.faq_count as number) ?? 5;
  const tone = (input.tone_of_voice as string) ?? 'expert';
  const geo = (input.geo_location as string) ?? '';
  const brand = (input.brand as string) ?? '';
  const cta = (input.cta as string) ?? '';
  const allLinks: Array<{url: string; anchor: string}> = [];
  if (brand && input.brand_url) allLinks.push({ url: input.brand_url as string, anchor: brand });
  const extLinks = (input.external_links as Array<{url: string; anchor: string}>) ?? [];
  allLinks.push(...extLinks);
  const forbiddenWords = (input.forbidden_words as string) ?? '';
  const legalRestrictions = (input.legal_restrictions as string) ?? '';

  // Структура заголовков из brief
  const structureLines: string[] = [];
  if (brief) {
    structureLines.push(`H1: ${brief.h1}`);
    for (const h2 of brief.h2_list ?? []) {
      structureLines.push(`  H2: ${h2.text}`);
      if (h2.thesis) structureLines.push(`    [Тезис: ${h2.thesis}]`);
      if (h2.facts?.length) structureLines.push(`    [Факты: ${h2.facts.join('; ')}]`);
      for (const h3 of h2.h3s ?? []) {
        structureLines.push(`    H3: ${h3}`);
      }
    }
  }

  // Вычисленные значения для промпта
  const mainKeywordMin = brief?.main_keyword_min ?? Math.max(2, Math.floor(charCount / 2500));
  const mainKeywordMax = brief?.main_keyword_max ?? Math.floor(charCount * 0.015 / 5);

  // Бюджетирование по блокам
  const h2Count = brief?.h2_list?.length ?? Math.round(charCount / 2000);
  const introBudget = 300;
  const conclusionBudget = 400;
  const faqBudget = faqCount * 200;
  const remainingForH2 = charCount - introBudget - conclusionBudget - faqBudget;
  const perH2Budget = Math.round(remainingForH2 / h2Count);

  const maxOutputTokens = Math.ceil(charCount * 0.5);

  const userMessage = `ОБЪЁМ СТАТЬИ: ровно ${charCount} символов чистого текста (без HTML). Допуск ±5%: от ${Math.round(charCount * 0.95)} до ${Math.round(charCount * 1.05)}.

Тема: ${targetQuery}
Intent: ${intent} | Tone: ${tone}
Ключи: ${keywords}
Основной ключ: ${mainKeywordMin}-${mainKeywordMax} вхождений
LSI: ${brief?.lsi_keywords?.join(', ') ?? 'сгенерируй'}
${faqCount > 0 ? `FAQ: ${faqCount} | ` : ''}Изображений: ${imageCount}
${faqCount === 0 ? 'FAQ-блок не нужен. Не добавляй раздел FAQ в статью.' : ''}
${geo ? `Гео: ${geo}` : ''}${brand ? `Бренд: ${brand}` : ''}${brand && input.brand_url ? ` | Ссылка: ${input.brand_url}` : ''}${brand && input.brand_description ? ` | О компании: ${input.brand_description}` : ''}
${forbiddenWords ? `Запрещённые слова: ${forbiddenWords}` : ''}
${legalRestrictions ? `Юр. ограничения: ${legalRestrictions}` : ''}

СТРУКТУРА (строго, не добавляй новых):
${structureLines.join('\n')}

БЮДЖЕТ: ввод ~${introBudget}с, каждый H2 ~${perH2Budget}с, FAQ ~${faqBudget}с, заключение ~${conclusionBudget}с.
${imageCount > 0 ? `\nМАРКЕРЫ КАРТИНОК: вставь ровно ${imageCount} маркеров [IMAGE_N] (N от 1 до ${imageCount}). После каждого: [IMAGE_N_DESC: описание сцены]. Первый после вводного абзаца, остальные по H2-блокам.` : ''}
${cta ? `\nCTA: ${cta}${input.cta_url ? ` (ссылка: ${input.cta_url})` : ''}` : ''}
${allLinks.length > 0 ? `\nСсылки (вставь как <a href="URL" target="_blank">анкор</a> в релевантных местах, макс 1 на H2-блок):\n${allLinks.map(l => `${l.url} → ${l.anchor}`).join('\n')}` : ''}
${cta && input.cta_url ? `CTA ссылка: ${input.cta_url}` : ''}

Формат: HTML (h1, h2, h3, p). Без strong и em тегов в абзацах.`;

  let articleHtml = '';
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      articleHtml = await generateText({
        model,
        systemPrompt,
        userMessage,
        maxOutputTokens,
      });
      articleHtml = articleHtml.replace(/^```html\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      break;
    } catch (err) {
      if (attempts >= maxAttempts) throw err;
      console.warn(`[step-3-draft] attempt ${attempts} failed, retrying...`);
    }
  }

  const h1Count = (articleHtml.match(/<h1[\s>]/gi) ?? []).length;
  const h2Count2 = (articleHtml.match(/<h2[\s>]/gi) ?? []).length;
  const imageMarkers = (articleHtml.match(/\[IMAGE_\d+\]/g) ?? []).length;
  const textLength = articleHtml.replace(/<[^>]*>/g, '').length;

  const warnings: string[] = [];
  if (h1Count !== 1) warnings.push(`H1 count: ${h1Count} (expected 1)`);
  if (imageCount > 0 && imageMarkers < imageCount) {
    warnings.push(`Image markers: ${imageMarkers} (expected ${imageCount})`);
  }
  if (textLength < charCount * 0.8) {
    warnings.push(`Text length: ${textLength} chars (expected ~${charCount})`);
  }
  if (textLength > charCount * 1.15) {
    warnings.push(`Text too long: ${textLength} chars (expected ~${charCount})`);
  }

  return {
    success: true,
    data: {
      article_html: articleHtml,
      char_count: textLength,
      h1_count: h1Count,
      h2_count: h2Count2,
      image_markers: imageMarkers,
      warnings,
      partial: articleHtml.slice(0, 500),
    },
    durationMs: Date.now() - start,
  };
}