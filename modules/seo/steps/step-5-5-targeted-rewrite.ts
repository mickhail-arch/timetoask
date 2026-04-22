// modules/seo/steps/step-5-5-targeted-rewrite.ts — Точечный рерайт проблемных абзацев
import type { StepResult, PipelineContext } from '../types';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { detectAIByCode } from '@/adapters/ai-detection';
import { sanitizeArticleHtml } from './sanitize-html';

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
  const articleBefore = articleHtml;

  const warnings: string[] = [];

  // 1. Кодовый AI-детект
  const plainText = articleHtml.replace(/<[^>]*>/g, '');
  const codeCheck = detectAIByCode(plainText);
  const initialScore = codeCheck.score;
  const codeMarkers = codeCheck.markers;
  console.info(`[step-5.5] Code AI check: score=${initialScore}%, markers: ${codeMarkers.length}`);

  // 2. Если score <= 15 — пропустить рерайт
  if (initialScore <= 15) {
    const skipRecheck = quickSeoRecheck(articleHtml, ctx.input);
    for (const issue of skipRecheck.issues) {
      warnings.push(`[recheck] ${issue}`);
    }
    return {
      success: true,
      data: {
        article_html: articleHtml,
        rewritten_count: 0,
        skipped: true,
        warnings,
        recheckMetrics: skipRecheck.metrics,
        final_ai_score: initialScore,
        partial: articleHtml.slice(0, 500),
      },
      durationMs: Date.now() - start,
    };
  }

  // 3. Метрики оригинала для валидации после рерайта
  const originalH1Count = (articleHtml.match(/<h1[\s>]/gi) ?? []).length;
  const originalH2Count = (articleHtml.match(/<h2[\s>]/gi) ?? []).length;
  const originalTextLength = articleHtml.replace(/<[^>]*>/g, '').length;
  const originalMarkerCount = (articleHtml.match(/\[IMAGE_\d+\]/g) ?? []).length;

  // 4. Один вызов модели с полным текстом
  const analysisModelChoice = (ctx.input.analysis_model as string) ?? 'sonnet';
  const ANALYSIS_MODEL_MAP: Record<string, string> = {
    sonnet: 'anthropic/claude-sonnet-4.6',
    opus47: 'anthropic/claude-opus-4-7',
  };
  const model = ANALYSIS_MODEL_MAP[analysisModelChoice] ?? ANALYSIS_MODEL_MAP.sonnet;

  const systemPrompt = `Ты — редактор-антидетектор. Твоя задача — переписать статью так, чтобы AI-детекторы не могли отличить её от написанной человеком.

КОДОВЫЙ АНАЛИЗ ОБНАРУЖИЛ ПРОБЛЕМЫ:
${codeMarkers.map(m => '- ' + m).join('\n')}

ПРАВИЛА ПЕРЕПИСЫВАНИЯ:
- Перепиши ТОЛЬКО проблемные предложения и абзацы вокруг них. Не трогай текст который звучит естественно.
- Сохрани ВСЕ заголовки H1/H2/H3 без изменений.
- Сохрани ВСЕ маркеры [IMAGE_N] и [IMAGE_N_DESC] на местах.
- Сохрани все ключевые слова и их позиции.
- Объём может измениться не более чем на ±15%.
- Формат: HTML (h1, h2, h3, p, blockquote, ul, ol, li, a, strong, em). Теги strong/em допустимы внутри blockquote (callout) и в сравнении (<p><strong>Название</strong></p>). В обычных <p> не добавляй strong/em.
- Callout-блоки и блок сравнения — НЕ ТРОГАЙ, оставь как есть.

ТЕХНИКИ ЧЕЛОВЕКОПОДОБНОГО ТЕКСТА:
- Рваный ритм: чередуй предложения 5-8 слов и 18-25 слов. Три одинаковой длины подряд — запрещено.
- Начинай абзацы по-разному: факт, вопрос, число, короткое утверждение.
- В каждом абзаце — минимум 1 конкретика: число, дата, пример, название.
- Добавь разговорные вставки: риторический вопрос, "если честно", "на практике".
- Убери все канцеляризмы: "стоит отметить", "важно подчеркнуть", "в настоящее время", "таким образом", "следует отметить", "необходимо учитывать", "как показывает практика".

Верни ТОЛЬКО переписанный HTML статьи целиком, без пояснений.`;

  try {
    const rewritten = await generateText({
      model,
      systemPrompt,
      userMessage: articleHtml,
    });

    const cleanRewritten = rewritten
      .replace(/^```html\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    // 6. Валидация после рерайта
    const rewrittenH1 = (cleanRewritten.match(/<h1[\s>]/gi) ?? []).length;
    const rewrittenH2 = (cleanRewritten.match(/<h2[\s>]/gi) ?? []).length;
    const rewrittenTextLength = cleanRewritten.replace(/<[^>]*>/g, '').length;
    const rewrittenMarkerCount = (cleanRewritten.match(/\[IMAGE_\d+\]/g) ?? []).length;

    const h1Ok = rewrittenH1 === originalH1Count;
    const h2Ok = Math.abs(rewrittenH2 - originalH2Count) <= 1;
    const lengthOk =
      rewrittenTextLength >= originalTextLength * 0.7 &&
      rewrittenTextLength <= originalTextLength * 1.3;
    const markersOk = originalMarkerCount === 0 || rewrittenMarkerCount >= originalMarkerCount;

    if (!h1Ok || !h2Ok || !lengthOk || !markersOk) {
      const reasons: string[] = [];
      if (!h1Ok) reasons.push(`H1: ${rewrittenH1} (ожидалось ${originalH1Count})`);
      if (!h2Ok) reasons.push(`H2: ${rewrittenH2} (ожидалось ${originalH2Count}±1)`);
      if (!lengthOk) reasons.push(`Длина: ${rewrittenTextLength} (ожидалось ${Math.round(originalTextLength * 0.7)}–${Math.round(originalTextLength * 1.3)})`);
      if (!markersOk) reasons.push(`IMAGE маркеры: ${rewrittenMarkerCount} (ожидалось >=${originalMarkerCount})`);
      warnings.push(`Рерайт откачен — валидация не пройдена: ${reasons.join('; ')}`);
      console.warn(`[step-5.5] Validation failed, rollback: ${reasons.join('; ')}`);
      articleHtml = articleBefore;
    } else {
      articleHtml = cleanRewritten;
    }
  } catch (err) {
    warnings.push(`Ошибка рерайта: ${err instanceof Error ? err.message : String(err)}`);
    console.warn('[step-5.5] Rewrite LLM error:', err);
    articleHtml = articleBefore;
  }

  // 6. Финальная оценка detectAIByCode
  const finalCodeCheck = detectAIByCode(articleHtml.replace(/<[^>]*>/g, ''));
  const rewriteApplied = articleHtml !== articleBefore;

  // 7. quickSeoRecheck
  const recheck = quickSeoRecheck(articleHtml, ctx.input);
  if (recheck.issues.length > 0) {
    for (const issue of recheck.issues) {
      warnings.push(`[recheck] ${issue}`);
    }
    console.warn('[step-5.5] SEO recheck issues:', recheck.issues);
  }

  articleHtml = sanitizeArticleHtml(articleHtml);

  return {
    success: true,
    data: {
      article_html: articleHtml,
      rewritten_count: rewriteApplied ? 1 : 0,
      skipped: false,
      warnings,
      recheckMetrics: recheck.metrics,
      final_ai_score: finalCodeCheck.score,
      partial: articleHtml.slice(0, 500),
    },
    durationMs: Date.now() - start,
  };
}
