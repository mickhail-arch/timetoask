//modules/seo/steps/step-3-draft.ts

import type { StepResult, PipelineContext, BriefData } from '../types';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { buildSystemPrompt } from '@/plugins/seo-article-express/prompt';
import { sanitizeArticleHtml } from './sanitize-html';

export async function executeDraft(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const aiModelChoice = (ctx.input.ai_model as string) ?? 'opus47';
  const DRAFT_MODEL_MAP: Record<string, string> = {
    gemini: 'google/gemini-3.1-pro-preview',
    sonnet: 'anthropic/claude-sonnet-4.6',
    opus47: 'anthropic/claude-opus-4-7',
  };
  const model = DRAFT_MODEL_MAP[aiModelChoice] ?? DRAFT_MODEL_MAP.opus47;
  const isGemini = model.includes('gemini');

  const brief = (ctx.data.confirmation as Record<string, unknown>)?.brief as BriefData
    ?? (ctx.data.brief as Record<string, unknown>)?.brief as BriefData;

  const targetQuery = (ctx.input.target_query as string) ?? '';
  const keywords = (ctx.input.keywords as string) ?? '';
  const charCount = (ctx.input.target_char_count as number) ?? 8000;
  const imageCount = (ctx.input.image_count as number) ?? 0;

  const builtPrompt = buildSystemPrompt(ctx.input, brief);
  const h2Count = brief.h2_list?.length || Math.round(charCount / 2000);
  const maxOutputTokens = isGemini
    ? Math.max(8000, Math.ceil(charCount * 1.2))
    : Math.max(4000, Math.ceil(charCount * 0.7));

  const userMessage = isGemini
    ? `Напиши статью по заданным параметрам. Все правила — в системном промпте.

Тема: ${targetQuery}
Ключевые слова: ${keywords}

КРИТИЧНО ПО ОБЪЁМУ: статья должна быть ровно ${charCount} символов чистого текста. Это абсолютное требование. Пиши каждый H2-раздел развёрнуто — минимум ${Math.round(charCount / h2Count)} символов на раздел. Статья короче ${Math.round(charCount * 0.93)} символов — БРАК.`
    : `Напиши статью по заданным параметрам. Все правила — в системном промпте.

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

      // Gemini часто выдаёт текст без <p> тегов — оборачиваем голые строки
      // Проверяем: если в тексте мало <p> тегов относительно длины — это Gemini-формат
      const pTagCount = (articleHtml.match(/<p[\s>]/gi) ?? []).length;
      const rawTextLength = articleHtml.replace(/<[^>]*>/g, '').length;
      const hasFewParagraphs = pTagCount < Math.floor(rawTextLength / 1000);

      if (hasFewParagraphs) {
        // Разбиваем по двойным переносам строк, оборачиваем в <p>
        // Но не трогаем строки, которые уже начинаются с HTML-тега
        articleHtml = articleHtml
          .split(/\n{2,}/)
          .map(block => {
            const trimmed = block.trim();
            if (!trimmed) return '';
            // Уже обёрнут в HTML-тег — не трогаем
            if (/^<(h[1-6]|p|ul|ol|li|blockquote|div|table|nav|img|a\s)/i.test(trimmed)) return trimmed;
            // Голый текст — оборачиваем в <p>
            return `<p>${trimmed}</p>`;
          })
          .filter(Boolean)
          .join('\n');

        console.info(`[step-3-draft] Auto-wrapped ${articleHtml.match(/<p>/g)?.length ?? 0} paragraphs (Gemini format detected)`);
      }

      // Конвертируем Markdown-артефакты в HTML если модель выдала смешанный формат
      // 1. Нумерованные списки вида "1. **Заголовок.** Текст" (Opus часто так делает)
      articleHtml = articleHtml.replace(/^(\d+)\.\s+\*\*([^*]+)\*\*\s*([\s\S]*?)(?=\n\d+\.\s+\*\*|\n*$)/gm, '<p><strong>$2</strong> $3</p>');
      // 2. Markdown bold **text** -> <strong>text</strong>
      articleHtml = articleHtml.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // 3. Markdown unordered list items (до italic, чтобы * списков не захватывался)
      articleHtml = articleHtml.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
      // 4. Markdown italic *text* -> <em>text</em> (ограничено одной строкой и 200 символами)
      articleHtml = articleHtml.replace(/(?<![*<])\*([^*\n]{1,200})\*(?![*>])/g, '<em>$1</em>');
      // 5. Markdown numbered list items (простые, без bold — уже обработан bold выше)
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
      // Агрессивная зачистка оставшихся вариантов TL;DR вне тегов <strong>
      articleHtml = articleHtml.replace(/\s*\(TL;?DR\)/gi, '');
      articleHtml = articleHtml.replace(/\s*\(TLDR\)/gi, '');
      articleHtml = articleHtml.replace(/\bTL;?DR:?\s*/gi, '');
      articleHtml = articleHtml.replace(/\bTLDR:?\s*/gi, '');

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
      const acceptThreshold = isGemini ? 0.90 : 0.85;
      if (currentTextLength >= charCount * acceptThreshold) {
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
