// modules/seo/steps/step-5-5-targeted-rewrite.ts — Точечный рерайт проблемных абзацев
import type { StepResult, PipelineContext } from '../types';
import { getStepModel } from '../config';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { detectAIByCode } from '@/adapters/ai-detection';
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

/**
 * Найти абзацы, содержащие проблемные предложения от Winston.
 * Возвращает абзацы с конкретными проблемами для рерайта.
 */
function findParagraphsWithWinstonSentences(
  paragraphs: string[],
  problematicSentences: string[],
): Array<{ index: number; html: string; text: string; problems: string[] }> {
  if (problematicSentences.length === 0) return [];

  const result: Array<{ index: number; html: string; text: string; problems: string[] }> = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const paraText = paragraphs[i].replace(/<[^>]*>/g, '').toLowerCase();
    const matchedProblems: string[] = [];

    for (const sentence of problematicSentences) {
      const searchSnippet = sentence.replace(/\.\.\.$/g, '').slice(0, 50).toLowerCase();
      if (searchSnippet.length > 10 && paraText.includes(searchSnippet)) {
        matchedProblems.push(`Winston AI пометил как AI-текст: "${sentence.slice(0, 80)}"`);
      }
    }

    if (matchedProblems.length > 0) {
      result.push({
        index: i,
        html: paragraphs[i],
        text: paragraphs[i].replace(/<[^>]*>/g, ''),
        problems: matchedProblems,
      });
    }
  }

  return result;
}

export async function executeTargetedRewrite(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const revData = ctx.data.ai_detect_revisions as Record<string, unknown> ?? {};
  let articleHtml = (revData.article_html as string) ?? '';
  const aiScore = (revData.final_ai_score as number) ?? 0;

  if (aiScore <= 15) {
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
        final_ai_score: aiScore,
        winston_recheck: false,
        partial: articleHtml.slice(0, 500),
      },
      durationMs: Date.now() - start,
    };
  }

  const config = ctx.config as ToolConfig | null;
  const model = getStepModel(config, 'revisions', 'google/gemini-2.5-flash');


  const paragraphs = extractParagraphs(articleHtml);

  // Источник 1: проблемные предложения от Winston (шаг 5)
  const winstonSentences = (revData.winston_problematic_sentences as string[]) ?? [];
  const winstonParagraphs = findParagraphsWithWinstonSentences(paragraphs, winstonSentences);

  // Источник 2: кодовый скоринг абзацев (как раньше)
  const codeScoredRaw: ParagraphScore[] = paragraphs
    .map((html, index) => {
      const text = html.replace(/<[^>]*>/g, '');
      return { index, html, text, score: 0, problems: [] as string[] };
    })
    .filter(p => p.text.length > 200)
    .map(p => {
      const result = scoreParagraph(p.text);
      return { ...p, score: result.score, problems: result.problems };
    })
    .filter(p => p.score > 0);

  // Объединить: Winston-абзацы приоритетнее, затем кодовые
  const winstonIndices = new Set(winstonParagraphs.map(p => p.index));
  const codeOnly = codeScoredRaw.filter(p => !winstonIndices.has(p.index));

  const toRewrite: Array<{ index: number; html: string; text: string; problems: string[] }> = [
    ...winstonParagraphs.map(p => ({
      ...p,
      problems: [
        ...p.problems,
        ...(codeScoredRaw.find(c => c.index === p.index)?.problems ?? []),
      ],
    })),
    ...codeOnly.sort((a, b) => b.score - a.score).slice(0, Math.max(0, 5 - winstonParagraphs.length)),
  ].slice(0, 5);

  const warnings: string[] = [];
  let rewrittenCount = 0;

  for (const para of toRewrite) {
    try {
      const problemList = para.problems.map((p, i) => `${i + 1}. ${p}`).join('\n');

      const rewritten = await generateText({
        model,
        systemPrompt: `Перепиши абзац, чтобы он звучал как написанный человеком-экспертом. Сохрани смысл, все ключевые слова и факты.

ПРОБЛЕМЫ ЭТОГО АБЗАЦА:
${problemList}

ПРАВИЛА ЧЕЛОВЕКОПОДОБНОГО ТЕКСТА:
- Начни с конкретного факта, числа, вопроса или живого примера — не с вводного слова.
- Чередуй длину предложений: одно короткое (5-8 слов), следующее длинное (18-25 слов).
- Добавь одну деталь от первого лица или конкретный пример из практики.
- Используй разговорную вставку: риторический вопрос, восклицание, обращение к читателю.
- Убери все канцеляризмы и стоп-конструкции.
- Не добавляй: "стоит отметить", "важно подчеркнуть", "в настоящее время", "таким образом", "следует отметить", "необходимо учитывать".
- Сохрани длину абзаца (±30%).

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
        warnings.push(`Абзац #${para.index + 1}: рерайт отклонён (длина)`);
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

  if (toRewrite.length === 0) {
    warnings.push('Проблемных абзацев не найдено — рерайт не потребовался');
  }

  let finalAiScore = aiScore;
  if (rewrittenCount > 0) {
    const recheckCode = detectAIByCode(articleHtml.replace(/<[^>]*>/g, ''));
    finalAiScore = recheckCode.score;
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
      final_ai_score: finalAiScore,
      winston_recheck: false,
      partial: articleHtml.slice(0, 500),
    },
    durationMs: Date.now() - start,
  };
}
