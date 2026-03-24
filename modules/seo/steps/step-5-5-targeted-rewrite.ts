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
  problems: string[];
}

function extractParagraphs(html: string): string[] {
  const matches = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
  return matches ?? [];
}

function scoreParagraph(text: string): { score: number; problems: string[] } {
  let score = 0;
  const problems: string[] = [];

  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Все предложения одинаковой длины (±3 слова)
  if (sentences.length >= 3) {
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const allSimilar = lengths.every(l => Math.abs(l - avg) <= 3);
    if (allSimilar) {
      score += 3;
      problems.push(`Все ${sentences.length} предложений одинаковой длины (~${Math.round(avg)} слов). Нужно: одно короткое (5-8 слов), одно длинное (18-25 слов).`);
    }
  }

  // Начинается со стоп-конструкции
  const lower = text.toLowerCase().trim();
  const foundStop = STOP_STARTS.find(s => lower.startsWith(s));
  if (foundStop) {
    score += 2;
    problems.push(`Начинается со стоп-конструкции "${foundStop}". Замени на конкретный факт, число или вопрос.`);
  }

  // Содержит стоп-конструкции внутри текста
  const innerStops = STOP_STARTS.filter(s => lower.includes(s) && !lower.startsWith(s));
  if (innerStops.length > 0) {
    score += innerStops.length;
    problems.push(`Содержит стоп-конструкции: ${innerStops.map(s => `"${s}"`).join(', ')}. Убери или замени на конкретику.`);
  }

  // Содержит 3+ вводных/филлерных слов
  const foundFillers: string[] = [];
  for (const word of FILLER_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const count = (text.match(regex) ?? []).length;
    if (count > 0) foundFillers.push(`"${word}" (${count}x)`);
  }
  if (foundFillers.length >= 3) {
    score += foundFillers.length;
    problems.push(`Много филлеров: ${foundFillers.join(', ')}. Убери лишние, оставь максимум 1.`);
  }

  // Нет конкретики (чисел, дат, названий)
  const hasNumbers = /\d/.test(text);
  const hasNames = /[A-ZА-ЯЁ][a-zа-яё]+(?:\s[A-ZА-ЯЁ][a-zа-яё]+)/.test(text);
  if (!hasNumbers && !hasNames && text.length > 300) {
    score += 1;
    problems.push('Нет конкретики: ни чисел, ни названий, ни дат. Добавь факт или пример.');
  }

  return { score, problems };
}

/**
 * Быстрая проверка ключевых SEO-метрик после правок.
 * Не заменяет полный аудит шага 4 — только ловит деградацию.
 */
function quickSeoRecheck(
  html: string,
  input: Record<string, unknown>,
): { issues: string[]; metrics: { water: number; spam: number; nauseaClassic: number; keywordDensity: number } } {
  const text = html.replace(/<[^>]*>/g, '');
  const textLower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const issues: string[] = [];

  const targetQuery = ((input.target_query as string) ?? '').toLowerCase();
  const mainKeyword = targetQuery.length <= 30 ? targetQuery : targetQuery.split(' ').slice(0, 4).join(' ');
  const keyRegex = new RegExp(mainKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const keyCount = (text.match(keyRegex) ?? []).length;
  const keywordDensity = text.length > 0 ? (keyCount * mainKeyword.length / text.length) * 100 : 0;

  if (keywordDensity < 0.4) issues.push(`Плотность ключа упала до ${keywordDensity.toFixed(2)}% (мин 0.5%)`);
  if (keywordDensity > 1.7) issues.push(`Плотность ключа выросла до ${keywordDensity.toFixed(2)}% (макс 1.5%)`);

  if (!textLower.slice(0, 300).includes(mainKeyword)) {
    issues.push('Основной ключ пропал из первых 300 символов');
  }

  const waterWords = new Set([
    'также', 'кроме', 'более', 'очень', 'достаточно', 'довольно', 'весьма',
    'просто', 'именно', 'даже', 'является', 'данный', 'данная', 'данное',
    'осуществлять', 'обеспечивать', 'представляет', 'безусловно', 'несомненно',
    'конечно', 'разумеется', 'абсолютно', 'совершенно', 'полностью', 'максимально',
  ]);
  let waterCount = 0;
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^а-яёa-z]/g, '');
    if (waterWords.has(wl)) waterCount++;
  }
  const water = wordCount > 0 ? Math.round((waterCount / wordCount) * 100) : 0;
  if (water > 25) issues.push(`Водность ${water}% (макс 25%)`);

  const wordFreq: Record<string, number> = {};
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^а-яёa-z]/g, '');
    if (wl.length > 3) wordFreq[wl] = (wordFreq[wl] ?? 0) + 1;
  }
  const totalSig = Object.values(wordFreq).reduce((a, b) => a + b, 0);
  const repeated = Object.values(wordFreq).filter(c => c > 2).reduce((a, b) => a + b, 0);
  const spam = totalSig > 0 ? Math.round((repeated / totalSig) * 100) : 0;
  if (spam > 60) issues.push(`Заспамленность ${spam}% (макс 60%)`);

  const maxFreq = Object.values(wordFreq).reduce((a, b) => Math.max(a, b), 0);
  const nauseaClassic = Math.round(Math.sqrt(maxFreq) * 10) / 10;
  if (nauseaClassic > 8) issues.push(`Тошнота ${nauseaClassic} (макс 8)`);

  const stopConstructions = [
    'в настоящее время', 'стоит отметить', 'как известно',
    'на сегодняшний день', 'важно отметить', 'следует подчеркнуть',
    'необходимо учитывать', 'таким образом', 'давайте разберёмся',
    'не секрет, что', 'в современном мире',
  ];
  for (const sc of stopConstructions) {
    if (textLower.includes(sc)) issues.push(`Стоп-конструкция после правок: "${sc}"`);
  }

  const forbiddenRaw = (input.forbidden_words as string) ?? '';
  const forbidden = forbiddenRaw.split('\n').map(w => w.trim().toLowerCase()).filter(Boolean);
  for (const fw of forbidden) {
    if (textLower.includes(fw)) issues.push(`Запрещённое слово после правок: "${fw}"`);
  }

  return { issues, metrics: { water, spam, nauseaClassic, keywordDensity } };
}

export async function executeTargetedRewrite(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const revData = ctx.data.ai_detect_revisions as Record<string, unknown> ?? {};
  let articleHtml = (revData.article_html as string) ?? '';
  const aiScore = (revData.final_ai_score as number) ?? 0;

  if (aiScore <= 25) {
    const skipRecheck = quickSeoRecheck(articleHtml, ctx.input);
    const skipWarnings: string[] = [];
    for (const issue of skipRecheck.issues) {
      skipWarnings.push(`[recheck] ${issue}`);
    }
    return {
      success: true,
      data: {
        article_html: articleHtml,
        rewritten_count: 0,
        skipped: true,
        warnings: skipWarnings,
        recheckMetrics: skipRecheck.metrics,
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
      return { index, html, text, score: 0, problems: [] as string[] };
    })
    .filter(p => p.text.length > 200)
    .map(p => {
      const result = scoreParagraph(p.text);
      return { ...p, score: result.score, problems: result.problems };
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const warnings: string[] = [];
  let rewrittenCount = 0;

  for (const para of scored) {
    try {
      const problemList = para.problems.map((p, i) => `${i + 1}. ${p}`).join('\n');

      const rewritten = await generateText({
        model,
        systemPrompt: `Перепиши абзац, исправив конкретные проблемы. Сохрани смысл, все ключевые слова и факты.

ПРОБЛЕМЫ ЭТОГО АБЗАЦА:
${problemList}

ПРАВИЛА:
- Исправь каждую указанную проблему.
- Сохрани длину абзаца (±30%).
- Не добавляй стоп-конструкции: "в настоящее время", "стоит отметить", "важно отметить", "таким образом" и подобные.
- Чередуй короткие (5-10 слов) и длинные (15-25 слов) предложения.
- Начни абзац с факта, числа, вопроса или примера — не с вводного слова.

Верни ТОЛЬКО переписанный текст абзаца без пояснений, без HTML-тегов.`,
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

  const recheck = quickSeoRecheck(articleHtml, ctx.input);
  if (recheck.issues.length > 0) {
    for (const issue of recheck.issues) {
      warnings.push(`[recheck] ${issue}`);
    }
    console.warn('[step-5.5] SEO recheck issues:', recheck.issues);
  }

  return {
    success: true,
    data: {
      article_html: articleHtml,
      rewritten_count: rewrittenCount,
      skipped: false,
      warnings,
      recheckMetrics: recheck.metrics,
      partial: articleHtml.slice(0, 500),
    },
    durationMs: Date.now() - start,
  };
}
