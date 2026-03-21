// adapters/ai-detection/ai-detection.adapter.ts — AI-детект через LLM-судью
import { generateText } from '@/adapters/llm/openrouter.adapter';

export interface AIDetectResult {
  score: number;       // 0–100
  markers: string[];   // обнаруженные AI-маркеры
  fix_instructions: string[]; // инструкции для правок
}

/**
 * Оценить текст на AI-написанность через LLM-судью.
 * Шкала: 0–35 pass, 36–100 fail.
 * Таймаут 30 сек → score 0, pass.
 */
export async function detectAI(
  text: string,
  model: string,
): Promise<AIDetectResult> {
  const systemPrompt = `Ты — эксперт по определению AI-генерированного текста на русском языке.

Оцени текст по следующим лексическим и структурным маркерам:
1. Однообразная длина предложений (AI пишет предложения одинаковой длины)
2. Шаблонные конструкции: «стоит отметить», «важно подчеркнуть», «в настоящее время», «таким образом»
3. Избыточная вводная часть перед основным содержанием
4. Отсутствие конкретных примеров, чисел, дат, кейсов
5. Однородная структура абзацев (каждый начинается одинаково)
6. Чрезмерная «вежливость» и обтекаемость формулировок
7. Отсутствие разговорных вставок, юмора, личного опыта
8. Равномерная длина H2-блоков (±10% разницы)

Шкала:
0–15: явно человеческий текст
16–25: скорее человеческий
26–35: пограничный, допустимый
36–50: заметные признаки AI
51–75: очевидно AI
76–100: чистый AI

Ответь ТОЛЬКО валидным JSON:
{
  "score": число 0-100,
  "markers": ["маркер 1", "маркер 2"],
  "fix_instructions": ["инструкция 1", "инструкция 2"]
}

markers — конкретные обнаруженные проблемы.
fix_instructions — что именно переписать для снижения AI-score.`;

  try {
    const result = await generateText({
      model,
      systemPrompt,
      userMessage: text,
    });

    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      score: Math.min(100, Math.max(0, Math.round(parsed.score ?? 50))),
      markers: Array.isArray(parsed.markers) ? parsed.markers : [],
      fix_instructions: Array.isArray(parsed.fix_instructions) ? parsed.fix_instructions : [],
    };
  } catch (err) {
    console.warn('[ai-detection] LLM error or parse failure, defaulting to score 0:', err);
    return { score: 0, markers: [], fix_instructions: [] };
  }
}
