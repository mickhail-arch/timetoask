//modules/seo/steps/step-3-draft.ts

import type { StepResult, PipelineContext, BriefData } from '../types';
import { getStepModel } from '../config';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { buildSystemPrompt } from '@/plugins/seo-article-express/prompt';
import { sanitizeArticleHtml } from './sanitize-html';
import type { ToolConfig } from '@/core/types';

export async function executeDraft(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const model = getStepModel(
    ctx.config as ToolConfig | null,
    'draft',
    'anthropic/claude-opus-4.6',
  );

  const brief = (ctx.data.confirmation as Record<string, unknown>)?.brief as BriefData
    ?? (ctx.data.brief as Record<string, unknown>)?.brief as BriefData;

  const targetQuery = (ctx.input.target_query as string) ?? '';
  const keywords = (ctx.input.keywords as string) ?? '';
  const charCount = (ctx.input.target_char_count as number) ?? 8000;
  const imageCount = (ctx.input.image_count as number) ?? 0;

  const builtPrompt = buildSystemPrompt(ctx.input, brief);
  const h2Count = brief.h2_list?.length || Math.round(charCount / 2000);
  const maxOutputTokens = Math.max(4000, Math.ceil(charCount * 0.7));

  const userMessage = `Напиши статью по заданным параметрам. Все правила — в системном промпте.

Тема: ${targetQuery}
Ключевые слова: ${keywords}`;

  let articleHtml = '';
  let attempts = 0;
  const maxAttempts = 3;
  let lastTextLength = 0;

  while (attempts < maxAttempts) {
    attempts++;

    let currentPrompt = builtPrompt;
    if (attempts > 1 && lastTextLength > 0) {
      const diff = charCount - lastTextLength;
      let additionalInstruction: string;
      if (diff > 0) {
        // Недобор
        additionalInstruction = `\n\n=== КРИТИЧЕСКАЯ КОРРЕКЦИЯ ОБЪЁМА ===\nПредыдущая попытка: ${lastTextLength} символов. Целевой: ${charCount}. Недобор: ${diff} символов.\nЭто НЕДОПУСТИМО. Увеличь объём КАЖДОГО H2-раздела. Добавь больше примеров, цифр, деталей. Не добавляй новые разделы — расширяй существующие. Каждый H2 должен быть на ${Math.round(diff / h2Count)} символов длиннее.`;
      } else {
        // Перебор
        const excess = Math.abs(diff);
        additionalInstruction = `\n\n=== КРИТИЧЕСКАЯ КОРРЕКЦИЯ ОБЪЁМА ===\nПредыдущая попытка: ${lastTextLength} символов. Целевой: ${charCount}. Перебор: ${excess} символов.\nЭто НЕДОПУСТИМО. Сократи КАЖДЫЙ H2-раздел. Убери лишние примеры, сократи длинные абзацы. Каждый H2 должен быть на ${Math.round(excess / h2Count)} символов короче. Не удаляй разделы целиком.`;
      }
      currentPrompt = builtPrompt + additionalInstruction;
    }

    try {
      articleHtml = await generateText({
        model,
        systemPrompt: currentPrompt,
        userMessage: attempts > 1
          ? `Напиши статью по заданным параметрам. Все правила — в системном промпте.\n\nТема: ${targetQuery}\nКлючевые слова: ${keywords}\n\nВНИМАНИЕ: объём статьи СТРОГО ${charCount} символов. Предыдущая попытка была слишком короткой (${lastTextLength} символов). Пиши развёрнуто.`
          : userMessage,
        maxOutputTokens,
      });
      articleHtml = articleHtml.replace(/^```html\s*/i, '').replace(/\s*```\s*$/i, '').trim();

      // Конвертируем Markdown-артефакты в HTML если модель выдала смешанный формат
      // 1. Нумерованные списки вида "1. **Заголовок.** Текст" (Opus часто так делает)
      articleHtml = articleHtml.replace(/^(\d+)\.\s+\*\*([^*]+)\*\*\s*([\s\S]*?)(?=\n\d+\.\s+\*\*|\n*$)/gm, '<p><strong>$2</strong> $3</p>');
      // 2. Markdown bold **text** -> <strong>text</strong>
      articleHtml = articleHtml.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // 3. Markdown italic *text* -> <em>text</em> (не внутри strong)
      articleHtml = articleHtml.replace(/(?<![*<])\*([^*]+)\*(?![*>])/g, '<em>$1</em>');
      // 4. Markdown unordered list items
      articleHtml = articleHtml.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
      // 5. Markdown numbered list items (простые, без bold)
      articleHtml = articleHtml.replace(/^\d+\.\s+(?!<)(.+)$/gm, '<li>$1</li>');
      // 6. Оборачиваем сиротские <li> в <ul>
      articleHtml = articleHtml.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, (match) => {
        // Не оборачиваем если уже внутри <ul> или <ol>
        if (/<[uo]l[\s>]/i.test(match)) return match;
        return `<ul>${match.trim()}</ul>`;
      });
      // 7. Убираем пустые строки между HTML-тегами
      articleHtml = articleHtml.replace(/>\n{2,}</g, '>\n<');

      // Автозамена TL;DR на "Кратко"
      articleHtml = articleHtml.replace(/<p><strong>TL;?DR:?<\/strong><\/p>/gi, '<p><strong>Кратко</strong></p>');
      articleHtml = articleHtml.replace(/<p><strong>TLDR:?<\/strong><\/p>/gi, '<p><strong>Кратко</strong></p>');
      articleHtml = articleHtml.replace(/<p><strong>Кратко\s*\(TL;?DR\):?<\/strong><\/p>/gi, '<p><strong>Кратко</strong></p>');
      articleHtml = articleHtml.replace(/<p><strong>Кратко\s*\(TLDR\):?<\/strong><\/p>/gi, '<p><strong>Кратко</strong></p>');
      articleHtml = articleHtml.replace(/<p><strong>Кратко\s*\/ TL;?DR:?<\/strong><\/p>/gi, '<p><strong>Кратко</strong></p>');
      articleHtml = articleHtml.replace(/<h2[^>]*>\s*Кратко.*?<\/h2>/gi, '<p><strong>Кратко</strong></p>');
      articleHtml = articleHtml.replace(/<h3[^>]*>\s*Кратко.*?<\/h3>/gi, '<p><strong>Кратко</strong></p>');

      const currentTextLength = articleHtml.replace(/<[^>]*>/g, '').length;
      lastTextLength = currentTextLength;

      // Если перебор >115% — retry с инструкцией "короче" (до 2 попыток)
      if (currentTextLength > charCount * 1.15 && attempts < maxAttempts) {
        console.warn(`[step-3-draft] attempt ${attempts}: ${currentTextLength} chars (target ${charCount}), too long, retrying shorter...`);
        // Следующая итерация while добавит коррекцию через additionalInstruction
        continue;
      }

      // Если перебор >115% на последней попытке — обрезаем
      if (currentTextLength > charCount * 1.15) {
        const targetCut = Math.round(charCount * 1.05);
        let plainIdx = 0;
        let htmlIdx = 0;
        while (htmlIdx < articleHtml.length && plainIdx < targetCut) {
          if (articleHtml[htmlIdx] === '<') {
            while (htmlIdx < articleHtml.length && articleHtml[htmlIdx] !== '>') htmlIdx++;
            htmlIdx++;
          } else {
            plainIdx++;
            htmlIdx++;
          }
        }
        const cutZone = articleHtml.slice(0, htmlIdx);
        const candidates = [
          cutZone.lastIndexOf('</p>'),
          cutZone.lastIndexOf('</ul>'),
          cutZone.lastIndexOf('</ol>'),
          cutZone.lastIndexOf('</blockquote>'),
        ].filter(pos => pos > 0);
        if (candidates.length > 0) {
          const lastPos = Math.max(...candidates);
          const closingTag = ['</p>', '</ul>', '</ol>', '</blockquote>'].find(tag => cutZone.lastIndexOf(tag) === lastPos) ?? '</p>';
          articleHtml = articleHtml.slice(0, lastPos + closingTag.length);
          console.warn(`[step-3-draft] Trimmed from ${currentTextLength} to ~${targetCut} chars`);
        }
        break;
      }

      // Если текст в допустимом диапазоне (85%-115%) — принимаем
      if (currentTextLength >= charCount * 0.85) {
        break;
      }

      console.warn(`[step-3-draft] attempt ${attempts}: ${currentTextLength} chars (target ${charCount}), too short, retrying...`);
      if (attempts >= maxAttempts) break;
    } catch (err) {
      if (attempts >= maxAttempts) throw err;
      console.warn(`[step-3-draft] attempt ${attempts} failed, retrying...`);
    }
  }

  articleHtml = sanitizeArticleHtml(articleHtml);

  const h1Count = (articleHtml.match(/<h1[\s>]/gi) ?? []).length;
  const actualH2Count = (articleHtml.match(/<h2[\s>]/gi) ?? []).length;
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
      h2_count: actualH2Count,
      image_markers: imageMarkers,
      warnings,
      partial: articleHtml.slice(0, 500),
    },
    durationMs: Date.now() - start,
  };
}
