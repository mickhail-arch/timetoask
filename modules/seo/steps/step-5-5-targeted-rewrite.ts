// modules/seo/steps/step-5-5-targeted-rewrite.ts — Точечный рерайт проблемных абзацев
import type { StepResult, PipelineContext } from '../types';
import { getStepModel } from '../config';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import type { ToolConfig } from '@/core/types';

const STOP_STARTS = [
  'важно отметить',
  'следует подчеркнуть',
  'необходимо учитывать',
  'стоит отметить',
  'нельзя не отметить',
  'в современном мире',
  'в настоящее время',
  'на сегодняшний день',
  'в заключение',
  'подводя итог',
  'таким образом',
  'в данном контексте',
  'в рамках данного',
  'как показывает практика',
  'не секрет, что',
];

const FILLER_WORDS = [
  'также',
  'кроме того',
  'более того',
  'помимо этого',
  'вместе с тем',
  'при этом',
  'в свою очередь',
  'безусловно',
  'несомненно',
  'разумеется',
];

interface ParagraphScore {
  index: number;
  html: string;
  text: string;
  score: number;
}

function extractParagraphs(html: string): string[] {
  const matches = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
  return matches ?? [];
}

function scoreParagraph(text: string): number {
  let score = 0;

  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Все предложения одинаковой длины (±3 слова)
  if (sentences.length >= 3) {
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const allSimilar = lengths.every(l => Math.abs(l - avg) <= 3);
    if (allSimilar) score += 3;
  }

  // Начинается со стоп-конструкции
  const lower = text.toLowerCase().trim();
  if (STOP_STARTS.some(s => lower.startsWith(s))) {
    score += 2;
  }

  // Содержит 3+ вводных/филлерных слов
  const fillerCount = FILLER_WORDS.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    return count + (text.match(regex) ?? []).length;
  }, 0);
  if (fillerCount >= 3) score += fillerCount;

  return score;
}

export async function executeTargetedRewrite(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const revData = ctx.data.ai_detect_revisions as Record<string, unknown> ?? {};
  let articleHtml = (revData.article_html as string) ?? '';
  const aiScore = (revData.final_ai_score as number) ?? 0;

  if (aiScore <= 25) {
    return {
      success: true,
      data: {
        article_html: articleHtml,
        rewritten_count: 0,
        skipped: true,
        warnings: [] as string[],
        partial: articleHtml.slice(0, 500),
      },
      durationMs: Date.now() - start,
    };
  }

  const config = ctx.config as ToolConfig | null;
  const model = getStepModel(config, 'revisions', 'google/gemini-2.5-flash');

  const paragraphs = extractParagraphs(articleHtml);

  const scored: ParagraphScore[] = paragraphs
    .map((html, index) => {
      const text = html.replace(/<[^>]*>/g, '');
      return { index, html, text, score: 0 };
    })
    .filter(p => p.text.length > 200)
    .map(p => ({ ...p, score: scoreParagraph(p.text) }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const warnings: string[] = [];
  let rewrittenCount = 0;

  for (const para of scored) {
    try {
      const rewritten = await generateText({
        model,
        systemPrompt:
          'Перепиши абзац, сохрани смысл и ключевые слова. ' +
          'Сделай более живым: добавь конкретику, убери канцеляризмы, разнообразь длину предложений. ' +
          'Верни ТОЛЬКО переписанный абзац без пояснений.',
        userMessage: para.text,
      });

      const cleanRewritten = rewritten
        .replace(/^```html\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();

      if (
        cleanRewritten.length < para.text.length * 0.5 ||
        cleanRewritten.length > para.text.length * 2
      ) {
        warnings.push(`Абзац #${para.index + 1}: рерайт отклонён (длина изменилась слишком сильно)`);
        continue;
      }

      const newParagraphHtml = `<p>${cleanRewritten}</p>`;
      articleHtml = articleHtml.replace(para.html, newParagraphHtml);
      rewrittenCount++;
    } catch (err) {
      warnings.push(
        `Абзац #${para.index + 1}: ошибка рерайта — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (scored.length === 0) {
    warnings.push('Проблемных абзацев не найдено — рерайт не потребовался');
  }

  return {
    success: true,
    data: {
      article_html: articleHtml,
      rewritten_count: rewrittenCount,
      skipped: false,
      warnings,
      partial: articleHtml.slice(0, 500),
    },
    durationMs: Date.now() - start,
  };
}
