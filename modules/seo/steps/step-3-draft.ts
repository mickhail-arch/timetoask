import type { StepResult, PipelineContext, BriefData } from '../types';
import { getStepModel } from '../config';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { buildSystemPrompt } from '@/plugins/seo-article-express/prompt';
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
  const maxOutputTokens = Math.ceil(charCount * 0.5);

  const userMessage = `Напиши статью по заданным параметрам. Все правила — в системном промпте.

Тема: ${targetQuery}
Ключевые слова: ${keywords}`;

  let articleHtml = '';
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      articleHtml = await generateText({
        model,
        systemPrompt: builtPrompt,
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
  if (textLength > charCount * 1.15) {
    warnings.push(`Text too long: ${textLength} chars (expected ~${charCount})`);
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
      partial: articleHtml.slice(0, 500),
    },
    durationMs: Date.now() - start,
  };
}
