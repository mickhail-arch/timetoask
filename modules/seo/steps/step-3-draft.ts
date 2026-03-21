// modules/seo/steps/step-3-draft.ts — написание чистовика (один вызов Claude)
import type { StepResult, PipelineContext, BriefData } from '../types';
import { getStepModel } from '../config';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { systemPrompt } from '@/plugins/seo-article-express/prompt';
import type { ToolConfig } from '@/core/types';

/**
 * Шаг 3: написание чистовика.
 * Один вызов Claude Sonnet — сразу готовый текст (черновик + редактура + EEAT + антидетект).
 * Маркеры [IMAGE_N] и [IMAGE_N_DESC: описание] для последующей генерации картинок.
 */
export async function executeDraft(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const model = getStepModel(
    ctx.config as ToolConfig | null,
    'draft',
    'anthropic/claude-sonnet-4-5',
  );

  // Собрать данные из предыдущих шагов
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
  const ownSources = (input.own_sources as string) ?? '';
  const forbiddenWords = (input.forbidden_words as string) ?? '';
  const legalRestrictions = (input.legal_restrictions as string) ?? '';

  // Структура заголовков из brief
  const structureLines: string[] = [];
  if (brief) {
    structureLines.push(`H1: ${brief.h1}`);
    for (const h2 of brief.h2_list ?? []) {
      structureLines.push(`  H2: ${h2.text}`);
      for (const h3 of h2.h3s ?? []) {
        structureLines.push(`    H3: ${h3}`);
      }
    }
  }

  // Вычисленные значения для промпта
  const mainKeywordMin = brief?.main_keyword_min ?? Math.max(2, Math.floor(charCount / 2500));
  const mainKeywordMax = brief?.main_keyword_max ?? Math.floor(charCount * 0.015 / 5);

  const userMessage = `ПАРАМЕТРЫ СТАТЬИ:
Тема: ${targetQuery}
Ключевые слова: ${keywords}
Intent: ${intent}
Целевой объём: ${charCount} символов (допуск ±10%)
Количество изображений: ${imageCount}
FAQ вопросов: ${faqCount}
Tone of voice: ${tone}
${geo ? `Гео: ${geo}` : ''}
${brand ? `Бренд: ${brand}` : ''}
${cta ? `CTA: ${cta}` : ''}
${ownSources ? `Собственные источники:\n${ownSources}` : ''}
${forbiddenWords ? `Запрещённые слова: ${forbiddenWords}` : ''}
${legalRestrictions ? `Юридические ограничения: ${legalRestrictions}` : ''}

УТВЕРЖДЁННАЯ СТРУКТУРА:
${structureLines.join('\n')}

LSI-ключи: ${brief?.lsi_keywords?.join(', ') ?? 'сгенерируй самостоятельно'}

ВЫЧИСЛЕННЫЕ ЗНАЧЕНИЯ:
- Основной ключ: от ${mainKeywordMin} до ${mainKeywordMax} вхождений
- Доп. ключи: по 1–2 вхождения каждого, равномерно по H2-блокам

Напиши полную статью в формате HTML. Маркеры изображений: [IMAGE_N] в позиции картинки + [IMAGE_N_DESC: описание сцены] на отдельной строке.`;

  // Попытка генерации (1 повтор при ошибке)
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
        maxOutputTokens: Math.ceil(charCount / 2), // ~2 символа на токен
      });
      break;
    } catch (err) {
      if (attempts >= maxAttempts) throw err;
      console.warn(`[step-3-draft] attempt ${attempts} failed, retrying...`);
    }
  }

  // Валидация результата
  const h1Count = (articleHtml.match(/<h1[\s>]/gi) ?? []).length;
  const h2Count = (articleHtml.match(/<h2[\s>]/gi) ?? []).length;
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

  return {
    success: true,
    data: {
      article_html: articleHtml,
      char_count: textLength,
      h1_count: h1Count,
      h2_count: h2Count,
      image_markers: imageMarkers,
      warnings,
      partial: articleHtml.slice(0, 500), // для стриминга в UI
    },
    durationMs: Date.now() - start,
  };
}
