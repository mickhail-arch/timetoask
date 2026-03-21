import { FORBIDDEN_WORDS } from './dictionary';
import { generateText } from '@/adapters/llm/openrouter.adapter';

export type ModerationCategory = 'A' | 'B' | 'C' | 'OK';

export interface FrontFilterResult {
  clean: boolean;
  found: string[];
}

export interface LlmModerationResult {
  category: ModerationCategory;
  reason?: string;
}

/**
 * Фронт-фильтр: проверка по словарю. Без LLM.
 * Ищет точные вхождения (регистронезависимо).
 */
export function frontFilter(text: string): FrontFilterResult {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const word of FORBIDDEN_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      found.push(word);
    }
  }

  return { clean: found.length === 0, found };
}

/**
 * LLM-классификатор: Gemini Flash оценивает контент.
 * Категории: A (блокировка), B (sensitive), C (дисклеймер), OK.
 * Таймаут 3 сек → OK + лог.
 */
export async function llmModerate(
  text: string,
  model: string,
): Promise<LlmModerationResult> {
  const systemPrompt = `Ты — модератор контента. Классифицируй текст пользователя в одну из категорий:
A — блокировка: порнография, насилие, наркотики, экстремизм, эксплуатация детей, мошенничество.
B — ограничения: политика, религия, медицина, финансы, азартные игры, алкоголь, табак.
C — дисклеймер: юридические вопросы, психология, спорная наука.
OK — чистый контент без ограничений.

Анализируй контекст: транслит, пробелы между буквами, замена кириллицы, эвфемизмы, комбинации безобидных слов. При сомнении между A и B — выбирай A. При сомнении между B и OK — выбирай B.

Ответь ТОЛЬКО JSON: {"category": "A"|"B"|"C"|"OK", "reason": "краткая причина если не OK"}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const result = await generateText({
      model,
      systemPrompt,
      userMessage: text,
    });

    clearTimeout(timeout);

    const parsed = JSON.parse(result);
    return {
      category: parsed.category ?? 'OK',
      reason: parsed.reason,
    };
  } catch (err) {
    console.warn('[moderation] LLM timeout or error, defaulting to OK:', err);
    return { category: 'OK' };
  }
}
