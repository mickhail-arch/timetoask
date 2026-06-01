// modules/keywords/keywords.service.ts — генерация SEO-ключей через LLM
import { generateText } from '@/adapters/llm';
import { KEYWORDS_MODEL, KEYWORDS_MAX_TOTAL } from '@/core/constants';
import { KEYWORDS_SYSTEM_PROMPT } from './prompt';

export interface KeywordsContext {
  intent?: string;
  geo?: string;
  forbidden?: string[];
}

const INTENT_LABELS: Record<string, string> = {
  informational: 'информационный',
  educational: 'обучающий / гайд',
  commercial: 'коммерческий (покупка)',
  comparative: 'сравнительный',
  review: 'обзорный',
  news: 'новостной',
  problem_solution: 'проблема–решение',
};

function parseKeywords(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((l) => l.length > 0);
}

function buildContextBlock(ctx: KeywordsContext): string {
  const parts: string[] = [];
  if (ctx.intent) parts.push(`Интент статьи: ${INTENT_LABELS[ctx.intent] ?? ctx.intent}.`);
  if (ctx.geo && ctx.geo.trim()) parts.push(`Гео: ${ctx.geo.trim()}. Можно добавлять локальные запросы.`);
  else parts.push('Гео не задано — не привязывай ключи к конкретным городам.');
  if (ctx.forbidden && ctx.forbidden.length) parts.push(`Запрещённые слова (не использовать): ${ctx.forbidden.join(', ')}.`);
  return parts.length ? `\n\n${parts.join('\n')}` : '';
}

async function askModel(
  topic: string,
  exclude: string[],
  count: number,
  ctx: KeywordsContext,
): Promise<string[]> {
  const excludeBlock = exclude.length
    ? `\n\nУже есть эти ключи — НЕ повторяй их и не дублируй по смыслу:\n${exclude.join('\n')}`
    : '';

  const userMessage = `Тема статьи: ${topic}${buildContextBlock(ctx)}\n\nСгенерируй РОВНО ${count} новых ключевых слов (не меньше).${excludeBlock}`;

  const raw = await generateText({
    model: KEYWORDS_MODEL,
    systemPrompt: KEYWORDS_SYSTEM_PROMPT,
    userMessage,
    temperature: 0.6,
    maxOutputTokens: 1000,
  });

  return parseKeywords(raw);
}

export async function generateKeywords(
  topic: string,
  existing: string[] = [],
  ctx: KeywordsContext = {},
): Promise<string[]> {
  const target = Math.max(0, KEYWORDS_MAX_TOTAL - existing.length);
  if (target === 0) return [];

  const forbiddenLower = (ctx.forbidden ?? []).map((w) => w.toLowerCase().trim()).filter(Boolean);
  const seen = new Set(existing.map((k) => k.toLowerCase().trim()));
  const result: string[] = [];

  const addUnique = (candidates: string[]) => {
    for (const k of candidates) {
      const key = k.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      if (forbiddenLower.some((w) => key.includes(w))) continue;
      seen.add(key);
      result.push(k);
      if (result.length >= target) break;
    }
  };

  addUnique(await askModel(topic, existing, target, ctx));

  if (result.length < target) {
    const shortfall = target - result.length;
    addUnique(await askModel(topic, [...existing, ...result], shortfall, ctx));
  }

  return result.slice(0, target);
}
