// Источник истины по лимитам структуры статьи (SEO + UX)
// Используется backend (step-1-2-brief) и frontend (ScreenBrief).

export interface StructureLimits {
  // Общие H2 включая FAQ и заключение
  h2: [number, number]; // [min, max]
  // Контентные H2 (без FAQ и заключения)
  contentH2Min: number;
  // H3 на один контентный H2
  h3PerH2: [number, number]; // [min, max]
  // Максимум H3 во всей статье (FAQ-вопросы не считаются)
  maxH3Total: number;
  // Минимум символов между смежными H2
  minCharsBetweenH2: number;
  // Минимум символов в H2 чтобы внутри был смысл H3
  minH2CharsForH3: number;
  // Максимум FAQ-вопросов для этого объёма
  maxFaq: number;
}

const TABLE: Record<number, StructureLimits> = {
  6000:  { h2: [4, 5],  contentH2Min: 2, h3PerH2: [0, 1], maxH3Total: 1,  minCharsBetweenH2: 600,  minH2CharsForH3: 1500, maxFaq: 3 },
  7000:  { h2: [4, 5],  contentH2Min: 3, h3PerH2: [0, 1], maxH3Total: 2,  minCharsBetweenH2: 600,  minH2CharsForH3: 1500, maxFaq: 3 },
  8000:  { h2: [5, 6],  contentH2Min: 3, h3PerH2: [0, 2], maxH3Total: 3,  minCharsBetweenH2: 600,  minH2CharsForH3: 1500, maxFaq: 4 },
  9000:  { h2: [5, 6],  contentH2Min: 4, h3PerH2: [0, 2], maxH3Total: 4,  minCharsBetweenH2: 700,  minH2CharsForH3: 1500, maxFaq: 4 },
  10000: { h2: [5, 7],  contentH2Min: 4, h3PerH2: [1, 2], maxH3Total: 5,  minCharsBetweenH2: 700,  minH2CharsForH3: 1500, maxFaq: 5 },
  11000: { h2: [6, 7],  contentH2Min: 4, h3PerH2: [1, 2], maxH3Total: 6,  minCharsBetweenH2: 700,  minH2CharsForH3: 1500, maxFaq: 5 },
  12000: { h2: [6, 8],  contentH2Min: 5, h3PerH2: [1, 2], maxH3Total: 8,  minCharsBetweenH2: 800,  minH2CharsForH3: 1500, maxFaq: 6 },
  13000: { h2: [7, 8],  contentH2Min: 5, h3PerH2: [1, 2], maxH3Total: 9,  minCharsBetweenH2: 800,  minH2CharsForH3: 1500, maxFaq: 6 },
  14000: { h2: [7, 9],  contentH2Min: 6, h3PerH2: [1, 3], maxH3Total: 11, minCharsBetweenH2: 800,  minH2CharsForH3: 1500, maxFaq: 7 },
  15000: { h2: [8, 9],  contentH2Min: 6, h3PerH2: [1, 3], maxH3Total: 13, minCharsBetweenH2: 1000, minH2CharsForH3: 1500, maxFaq: 8 },
  16000: { h2: [8, 10], contentH2Min: 6, h3PerH2: [2, 3], maxH3Total: 15, minCharsBetweenH2: 1000, minH2CharsForH3: 1500, maxFaq: 8 },
  17000: { h2: [8, 10], contentH2Min: 7, h3PerH2: [2, 3], maxH3Total: 17, minCharsBetweenH2: 1000, minH2CharsForH3: 1500, maxFaq: 9 },
  18000: { h2: [9, 11], contentH2Min: 7, h3PerH2: [2, 3], maxH3Total: 20, minCharsBetweenH2: 1000, minH2CharsForH3: 1500, maxFaq: 10 },
  19000: { h2: [9, 11], contentH2Min: 8, h3PerH2: [2, 4], maxH3Total: 23, minCharsBetweenH2: 1200, minH2CharsForH3: 1500, maxFaq: 10 },
  20000: { h2: [10, 12], contentH2Min: 8, h3PerH2: [2, 4], maxH3Total: 26, minCharsBetweenH2: 1200, minH2CharsForH3: 1500, maxFaq: 10 },
};

// Модификатор maxH3Total по intent
const INTENT_H3_MODIFIER: Record<string, number> = {
  educational: 1.3,     // обучающие — больше H3 (шаги)
  problem_solution: 1.2,
  informational: 1.0,
  commercial: 1.0,
  review: 1.0,
  comparative: 0.8,     // сравнительные — H2 на варианты, H3 редко
  news: 0.7,             // новости — короткая иерархия
};

// Модификатор maxFaq по intent
const INTENT_FAQ_MODIFIER: Record<string, number> = {
  commercial: 1.0,
  review: 1.0,
  informational: 1.0,
  educational: 0.7,    // в обучающих FAQ менее критичен
  problem_solution: 1.0,
  comparative: 0.8,
  news: 0.3,            // в новостях FAQ почти не нужен
};

export function getStructureLimits(charCount: number, intent?: string): StructureLimits {
  // Находим ближайший ключ снизу
  const keys = Object.keys(TABLE).map(Number).sort((a, b) => a - b);
  let best = keys[0];
  for (const k of keys) {
    if (charCount >= k) best = k;
  }
  const base = TABLE[best];

  // Применяем intent-модификатор
  const h3Mod = intent ? (INTENT_H3_MODIFIER[intent] ?? 1.0) : 1.0;
  const faqMod = intent ? (INTENT_FAQ_MODIFIER[intent] ?? 1.0) : 1.0;

  return {
    ...base,
    maxH3Total: Math.max(0, Math.round(base.maxH3Total * h3Mod)),
    maxFaq: Math.max(0, Math.round(base.maxFaq * faqMod)),
  };
}

// Удобный экспорт списка регулярок для определения FAQ/заключения
export const FAQ_RE = /faq|часто задаваемые|вопрос/i;
export const CONCLUSION_RE = /заключение|итог|вывод|резюме|подведём итог/i;
