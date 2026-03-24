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

export interface AICodeCheckResult {
  score: number;
  markers: string[];
}

/**
 * Кодовая проверка AI-маркеров без LLM ($0).
 * Дополняет LLM-детект — ловит структурные паттерны которые LLM может пропустить при самооценке.
 */
export function detectAIByCode(text: string): AICodeCheckResult {
  const markers: string[] = [];
  let score = 0;

  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
  if (sentences.length < 3) return { score: 0, markers: [] };

  // 1. Однообразная длина предложений
  const sentLengths = sentences.map(s => s.split(/\s+/).length);
  const avgLen = sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length;
  const stdDev = Math.sqrt(sentLengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / sentLengths.length);
  const coeffVariation = avgLen > 0 ? stdDev / avgLen : 0;
  if (coeffVariation < 0.25) {
    score += 15;
    markers.push(`Однообразная длина предложений (CV=${(coeffVariation * 100).toFixed(0)}%, норма >25%)`);
  } else if (coeffVariation < 0.35) {
    score += 5;
    markers.push(`Слабая вариативность длины предложений (CV=${(coeffVariation * 100).toFixed(0)}%)`);
  }

  // 2. Одинаковые начала предложений
  const firstWords = sentences.map(s => {
    const w = s.split(/\s+/)[0];
    return w ? w.toLowerCase().replace(/[^а-яёa-z]/g, '') : '';
  }).filter(Boolean);
  const fwFreq: Record<string, number> = {};
  for (const fw of firstWords) fwFreq[fw] = (fwFreq[fw] ?? 0) + 1;
  const maxFwRatio = firstWords.length > 0 ? Math.max(...Object.values(fwFreq)) / firstWords.length : 0;
  if (maxFwRatio > 0.3) {
    score += 10;
    const topWord = Object.entries(fwFreq).sort((a, b) => b[1] - a[1])[0][0];
    markers.push(`${Math.round(maxFwRatio * 100)}% предложений начинаются с "${topWord}"`);
  }

  // 3. Одинаковые начала абзацев
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 50);
  if (paragraphs.length >= 3) {
    const paraStarts = paragraphs.map(p => p.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase());
    let consecutiveSame = 0;
    for (let i = 1; i < paraStarts.length; i++) {
      if (paraStarts[i] === paraStarts[i - 1]) {
        consecutiveSame++;
      }
    }
    if (consecutiveSame >= 2) {
      score += 10;
      markers.push(`${consecutiveSame + 1} абзацев подряд начинаются одинаково`);
    }
  }

  // 4. Стоп-конструкции
  const textLower = text.toLowerCase();
  const stopConstructions = [
    'в настоящее время', 'стоит отметить', 'как известно',
    'на сегодняшний день', 'важно отметить', 'следует подчеркнуть',
    'необходимо учитывать', 'таким образом', 'давайте разберёмся',
    'не секрет, что', 'в современном мире', 'нельзя не отметить',
    'хочется отметить', 'как показывает практика',
  ];
  let stopCount = 0;
  for (const sc of stopConstructions) {
    if (textLower.includes(sc)) stopCount++;
  }
  if (stopCount >= 3) {
    score += 15;
    markers.push(`${stopCount} стоп-конструкций в тексте`);
  } else if (stopCount >= 1) {
    score += stopCount * 3;
    markers.push(`${stopCount} стоп-конструкций в тексте`);
  }

  // 5. Равномерная длина абзацев
  if (paragraphs.length >= 4) {
    const paraLens = paragraphs.map(p => p.length);
    const paraAvg = paraLens.reduce((a, b) => a + b, 0) / paraLens.length;
    const paraStdDev = Math.sqrt(paraLens.reduce((sum, l) => sum + (l - paraAvg) ** 2, 0) / paraLens.length);
    const paraCV = paraAvg > 0 ? paraStdDev / paraAvg : 0;
    if (paraCV < 0.2) {
      score += 10;
      markers.push(`Равномерная длина абзацев (CV=${(paraCV * 100).toFixed(0)}%)`);
    }
  }

  // 6. Отсутствие конкретики (чисел, дат)
  const numbers = text.match(/\d+/g) ?? [];
  const numbersPerSentence = sentences.length > 0 ? numbers.length / sentences.length : 0;
  if (numbersPerSentence < 0.05 && text.length > 2000) {
    score += 10;
    markers.push('Почти нет чисел и дат в тексте');
  }

  // 7. Три+ предложения одинаковой длины подряд (±2 слова)
  let streaks = 0;
  for (let i = 0; i <= sentLengths.length - 3; i++) {
    if (Math.abs(sentLengths[i] - sentLengths[i + 1]) <= 2
      && Math.abs(sentLengths[i + 1] - sentLengths[i + 2]) <= 2) {
      streaks++;
    }
  }
  if (streaks >= 3) {
    score += 10;
    markers.push(`${streaks} серий из 3+ предложений одинаковой длины`);
  } else if (streaks >= 1) {
    score += streaks * 3;
  }

  return { score: Math.min(100, score), markers };
}
