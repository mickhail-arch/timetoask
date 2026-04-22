//Файл: plugins/seo-article-express/prompt.ts

import type { BriefData } from '@/modules/seo/types';

const ROLE_BLOCK = `=== РОЛЬ И ЗАДАЧА ===
Ты — профессиональный SEO-копирайтер с 10-летним опытом. Ты пишешь статьи которые НЕВОЗМОЖНО отличить от написанных человеком. Это твой главный приоритет наравне с SEO.
Пишешь чистовую статью на русском языке за один проход.
Формат вывода: допустимые HTML-теги — h1, h2, h3, p, blockquote, ul, ol, li, a, img, strong, em (strong только внутри blockquote для заголовка callout, em только внутри blockquote для текста callout). Никаких других тегов — без b, i, div, span.
Если название бренда, платформы или сервиса имеет латинское написание — всегда используй латиницу (Poizon, не Пойзон; Dewu, не Дэву). Транслитерацию используй только если она является отдельным ключевым словом.
КРИТИЧНО: Пиши как живой человек-эксперт, а не как AI-ассистент. Это значит: неравномерные абзацы, рваный ритм предложений, конкретные примеры вместо обобщений, разговорные вставки, личный опыт. Текст в стиле "Платформа предоставляет... Система обеспечивает... Важно отметить..." — это брак.
ЗАПРЕЩЁННЫЕ ТЕГИ: h4, h5, h6. Никогда не используй заголовки ниже H3. Вся структура строится только на H1, H2, H3.
Все заголовки H1, H2, H3 начинаются с заглавной буквы. Заголовок со строчной буквы — брак.
Обязательные H2-заголовки которые нельзя понижать до H3: "Заключение" — всегда H2, "Часто задаваемые вопросы" — всегда H2. Вопросы внутри FAQ — всегда H3. Если нужен подзаголовок внутри H3-секции — используй bold текст в абзаце через strong, не H4.`;

interface ArticleProfile {
  intro: number;
  tldr: { chars: number; items: number };
  body: number;
  comparison: { chars: number; objects: number; criteria: number };
  case: { chars: number; style: 'short' | 'full' };
  conclusion: number;
  faq: { chars: number; count: number };
  callout: { count: number; charsEach: number };
  citations: { count: number };
  toc: boolean;
}

function getArticleProfile(
  charCount: number,
  faqCount: number,
  comparisonEnabled: boolean,
  comparisonObjectsInput: number,
  comparisonCriteriaInput: number,
): ArticleProfile {
  const intro = Math.round(charCount * 0.04);
  const tldrItems = Math.min(5, Math.max(3, Math.floor(charCount / 2500)));
  const tldrChars = Math.round(charCount * 0.02);

  let comparisonObjects: number;
  let comparisonCriteria: number;
  let comparisonChars: number;
  let caseStyle: 'short' | 'full';
  let caseChars: number;
  let calloutCount: number;
  let citationCount: number;
  let toc: boolean;

  if (charCount <= 6000) {
    comparisonObjects = 2; comparisonCriteria = 3; comparisonChars = Math.round(charCount * 0.05);
    caseStyle = 'short'; caseChars = Math.round(charCount * 0.03);
    calloutCount = 1; citationCount = 0; toc = false;
  } else if (charCount <= 8000) {
    comparisonObjects = 2; comparisonCriteria = 3; comparisonChars = Math.round(charCount * 0.05);
    caseStyle = 'short'; caseChars = Math.round(charCount * 0.04);
    calloutCount = 2; citationCount = 0; toc = true;
  } else if (charCount <= 10000) {
    comparisonObjects = 3; comparisonCriteria = 4; comparisonChars = Math.round(charCount * 0.05);
    caseStyle = 'full'; caseChars = Math.round(charCount * 0.04);
    calloutCount = 2; citationCount = 1; toc = true;
  } else if (charCount <= 12000) {
    comparisonObjects = 3; comparisonCriteria = 4; comparisonChars = Math.round(charCount * 0.05);
    caseStyle = 'full'; caseChars = Math.round(charCount * 0.04);
    calloutCount = 3; citationCount = 1; toc = true;
  } else if (charCount <= 14000) {
    comparisonObjects = 3; comparisonCriteria = 4; comparisonChars = Math.round(charCount * 0.05);
    caseStyle = 'full'; caseChars = Math.round(charCount * 0.04);
    calloutCount = 3; citationCount = 2; toc = true;
  } else if (charCount <= 16000) {
    comparisonObjects = 4; comparisonCriteria = 4; comparisonChars = Math.round(charCount * 0.05);
    caseStyle = 'full'; caseChars = Math.round(charCount * 0.04);
    calloutCount = 3; citationCount = 2; toc = true;
  } else if (charCount <= 18000) {
    comparisonObjects = 4; comparisonCriteria = 4; comparisonChars = Math.round(charCount * 0.05);
    caseStyle = 'full'; caseChars = Math.round(charCount * 0.04);
    calloutCount = 4; citationCount = 2; toc = true;
  } else {
    comparisonObjects = 4; comparisonCriteria = 4; comparisonChars = Math.round(charCount * 0.05);
    caseStyle = 'full'; caseChars = Math.round(charCount * 0.04);
    calloutCount = 4; citationCount = 2; toc = true;
  }

  if (!comparisonEnabled) {
    comparisonObjects = 0;
    comparisonCriteria = 0;
    comparisonChars = 0;
  } else {
    comparisonObjects = comparisonObjectsInput;
    comparisonCriteria = comparisonCriteriaInput;
    comparisonChars = Math.round(charCount * 0.05);
  }

  const conclusionChars = Math.round(charCount * 0.04);
  const faqChars = faqCount * 200;
  const bodyChars = charCount - intro - tldrChars - comparisonChars - caseChars - conclusionChars - faqChars;

  return {
    intro,
    tldr: { chars: tldrChars, items: tldrItems },
    body: bodyChars,
    comparison: { chars: comparisonChars, objects: comparisonObjects, criteria: comparisonCriteria },
    case: { chars: caseChars, style: caseStyle },
    conclusion: conclusionChars,
    faq: { chars: faqChars, count: faqCount },
    callout: { count: calloutCount, charsEach: Math.round(Math.min(120, Math.max(50, charCount * 0.01))) },
    citations: { count: citationCount },
    toc,
  };
}

function buildVolumeBlock(charCount: number): string {
  const min = Math.round(charCount * 0.93);
  const max = Math.round(charCount * 1.05);
  return `=== ОБЪЁМ ===
Целевой объём: ровно ${charCount} символов чистого текста (без HTML-тегов). Допуск: от ${min} до ${max}.
Это жёсткое ограничение. Статья короче ${min} символов — БРАК, будет отправлена на перегенерацию.
Лучше написать на 3-5% больше целевого, чем недобрать. Но превышение более чем на 10% — тоже брак. Строго держись в диапазоне от ${min} до ${max} символов.
Частая ошибка: статья получается на 15-25% короче целевого. Чтобы избежать этого — пиши каждый H2-раздел развёрнуто, с примерами и цифрами, не менее ${Math.round(charCount / (Math.round(charCount / 2000)))} символов на раздел.`;
}

function buildStructureBlock(brief: BriefData): string {
  const lines: string[] = [`H1: ${brief.h1}`];
  for (const h2 of brief.h2_list ?? []) {
    lines.push(`  H2: ${h2.text}`);
    if (h2.thesis) lines.push(`    [Тезис: ${h2.thesis}]`);
    if (h2.facts?.length) lines.push(`    [Факты для раздела: ${h2.facts.join('; ')}]`);
    for (const h3 of h2.h3s ?? []) {
      lines.push(`    H3: ${h3}`);
    }
  }
  return `=== СТРУКТУРА СТАТЬИ ===
Строго следуй этой структуре. Не добавляй и не убирай заголовки.

${lines.join('\n')}

Правила структуры:
- Строго 1 H1, содержит основной ключ, до 60-70 символов.
- H3 только внутри H2.
- Минимум 300 символов текста между любыми двумя заголовками.
- Последние 300-500 символов — заключение без нового H2.
КРИТИЧНО ПО ЗАГОЛОВКАМ:
- H2 в структуре выше — это ОСНОВНЫЕ разделы. К ним добавляются служебные H2: "Заключение" и "Часто задаваемые вопросы" (если FAQ включён).
- Количество H3 ограничено ТЗ и считается ТОЛЬКО для основных H2. Вопросы FAQ (H3 внутри H2 FAQ) НЕ входят в лимит H3.
- Если в ТЗ maxH3Total = 0 — в основных H2 не создавай H3 вообще. FAQ-вопросы при этом остаются H3.
- H3 ставь только в H2-разделах длиннее 1500 символов где тема делится на подтемы.
- Блок сравнения: <p><strong>Название</strong></p> + <ul>, НЕ через H3.
- Оглавление, содержание, навигацию — НЕ создавай.`;
}

function buildBudgetBlock(charCount: number, h2Count: number, profile: ArticleProfile): string {
  const perH2 = Math.round(profile.body / h2Count);
  const total = profile.intro + profile.tldr.chars + profile.body + profile.comparison.chars + profile.case.chars + profile.conclusion + profile.faq.chars;

  let lines = `=== БЮДЖЕТ СИМВОЛОВ ===
Общий объём: ${charCount} символов. Распределение:

- Введение: ~${profile.intro} символов
- Блок «Кратко»: ~${profile.tldr.chars} символов (${profile.tldr.items} пунктов)
- Основной текст (${h2Count} H2): ~${profile.body} символов (~${perH2} на H2)`;

  if (profile.comparison.chars > 0) {
    lines += `\n- Блок сравнения: ~${profile.comparison.chars} символов (${profile.comparison.objects} объекта по ${profile.comparison.criteria} критерия)`;
  }

  lines += `\n- Личный опыт: ~${profile.case.chars} символов${profile.case.style === 'short' ? ' (2-3 предложения)' : ' (полный кейс с 5 шагами)'}
- Заключение (H2): ~${profile.conclusion} символов
- FAQ (${profile.faq.count} вопросов): ~${profile.faq.chars} символов`;

  lines += `\n\nВстроены в основной текст (не добавляют объём сверху):`;
  lines += `\n- Callout-блоки: ${profile.callout.count} шт по ${profile.callout.charsEach} символов`;
  if (profile.citations.count > 0) {
    lines += `\n- Цитаты экспертов: ${profile.citations.count} шт по 150-250 символов`;
  }
  if (profile.toc) {
    lines += `\n- Оглавление: да (не считается в объём)`;
  }

  lines += `\n\nПроверочная сумма: ${total} символов. Целевой: ${charCount}. ${Math.abs(total - charCount) > charCount * 0.05 ? 'ВНИМАНИЕ: сумма не сходится, скорректируй основной текст.' : 'Сходится.'}`;

  return lines;
}

function buildMainKeywordBlock(brief: BriefData, imageCount: number, charCount: number): string {
  const minOccurrences = Math.max(2, Math.floor(charCount / 2500));
  const maxOccurrences = Math.max(3, Math.floor(charCount / 1200));
  const densityMax = charCount <= 6000 ? 1.0 : 1.2;

  let block = `=== ОСНОВНОЙ КЛЮЧ ===
Ключ: "${brief.main_keyword}"
Вхождений: от ${minOccurrences} до ${maxOccurrences}. Превышение ${maxOccurrences} — переспам, это брак.
Плотность: 0.5-${densityMax}%.

Обязательные точки:
1. H1 (точное или морфологическое)
2. Первые 300 символов (точное)
3. Один H2 (разбавленное)
4. Заключение (любая форма)`;
  if (imageCount > 0) block += `\n5. Alt первой картинки`;

  block += `

Формы: 30-40% точные, 60-70% морфологические и СИНОНИМЫ.
Не чаще 1 раз на ${charCount <= 6000 ? '1200' : '1000'} символов.
Точная форма 2 раза в радиусе 500 символов — запрещено.

ВАЖНО: активно используй синонимы вместо повтора ключа. Чередуй с родовыми понятиями: "сервис", "платформа", "инструмент", "решение". Читатель не должен замечать SEO-оптимизацию.`;
  return block;
}

function buildAdditionalKeysBlock(
  keywords: string,
  keysPerSection: number,
  charCount: number,
): string {
  const keywordList = keywords.split('\n').filter(Boolean);
  const maxPerKey = charCount <= 6000 ? 1 : 2;
  const perSection = Math.min(keysPerSection, charCount <= 6000 ? 1 : 2);

  return `=== ДОПОЛНИТЕЛЬНЫЕ КЛЮЧИ ===
Ключи:
${keywords}
Каждый ключ: строго ${maxPerKey} вхождение. Макс ключей на H2-блок: ${perSection}.
Не насыщай текст ключами — текст для читателя, не для робота.

Стоп-правила (нарушение = брак):
- Два ключа в одном предложении — запрещено.
- Ключ в первом слове после заголовка — запрещено.
- Ключ в конце абзаца + начале следующего подряд — запрещено.
- Один доп.ключ в двух заголовках — запрещено.`;
}

function buildLsiBlock(lsiKeywords: string[], charCount: number): string {
  const lsiPer2000 = charCount <= 6000 ? '1-2' : '2-3';
  return `=== LSI-КЛЮЧИ ===
LSI: ${lsiKeywords.join(', ')}
Используй ${lsiPer2000} уникальных LSI на каждые 2000 символов. Встраивай естественно.`;
}

const INTENT_MAP: Record<string, { name: string; structure: string }> = {
  informational: {
    name: 'ИНФОРМАЦИОННЫЙ',
    structure: 'определение → разбор → примеры → вывод',
  },
  educational: {
    name: 'ОБУЧАЮЩИЙ',
    structure: 'вводная → шаги → советы → типичные ошибки',
  },
  commercial: {
    name: 'КОММЕРЧЕСКИЙ',
    structure:
      'проблема → решение → преимущества. Мини-CTA на 60% текста + полный CTA в конце',
  },
  comparative: {
    name: 'СРАВНИТЕЛЬНЫЙ',
    structure: 'критерии → сравнение → рекомендация',
  },
  review: {
    name: 'ОБЗОРНЫЙ',
    structure: 'описание → плюсы/минусы → вердикт',
  },
  news: {
    name: 'НОВОСТНОЙ',
    structure: 'контекст → суть → последствия',
  },
  problem_solution: {
    name: 'ПРОБЛЕМА–РЕШЕНИЕ',
    structure: 'проблема → причины → решения',
  },
};

function buildIntentBlock(intent: string): string {
  const entry = INTENT_MAP[intent] ?? INTENT_MAP.informational!;
  return `=== INTENT: ${entry.name} ===
Логика изложения: ${entry.structure}`;
}

const TONE_MAP: Record<string, string> = {
  expert:
    'Уверенный экспертный тон. Терминология уместна. Средняя длина предложения: 12-18 слов. Обращение: «вы».',
  conversational:
    'Дружелюбный разговорный тон. Простой язык. 8-14 слов в предложении. Обращение: «ты».',
  business:
    'Формальный деловой тон. Без эмоций и просторечий. 14-20 слов. Обращение: «вы».',
  sales:
    'Продающий тон. Акцент на выгодах и триггерах. 8-15 слов. Обращение: «вы».',
  scientific:
    'Сухой научный стиль. Опора на данные. 15-25 слов. Безличное изложение.',
  simple:
    'Максимально простой и понятный язык. 6-12 слов. Обращение: «вы».',
};

function buildToneBlock(tone: string, toneComment?: string): string {
  const desc =
    TONE_MAP[tone] ??
    `Стиль текста: ${tone}. Следуй этому описанию стиля.`;

  let block = `=== СТИЛЬ ТЕКСТА ===\n${desc}`;

  if (toneComment) {
    block += `\n\nДополнительные пожелания автора к стилю:\n${toneComment}\n\nЭти пожелания ДОПОЛНЯЮТ базовый тон, а не заменяют его. Совмести базовый стиль с пожеланиями. Если пожелания противоречат базовому тону — приоритет у пожеланий.`;
  }

  return block;
}

const AGE_MAP: Record<string, string> = {
  '0-18': 'Простой язык, без контента 18+.',
  '18-24': 'Динамичный стиль, актуальные тренды.',
  '25-34': 'Баланс экспертности и доступности.',
  '35-44': 'Практичность, ROI, конкретные результаты.',
  '45-54': 'Надёжность, проверенные решения.',
  '55+': 'Простота изложения, без сленга и англицизмов.',
};

function buildAudienceBlock(
  gender: string,
  ages: string[],
): string | null {
  const isDefaultGender = gender === 'all';
  const isDefaultAge = ages.length === 1 && ages[0] === 'all';

  if (isDefaultGender && isDefaultAge) return null;

  const parts: string[] = [];

  if (!isDefaultAge) {
    const descs = ages
      .filter((a) => a !== 'all')
      .map((a) => AGE_MAP[a])
      .filter(Boolean);
    if (descs.length) parts.push(descs.join(', '));
  }

  if (gender === 'male')
    parts.push('Акцент на технических деталях и цифрах.');
  if (gender === 'female')
    parts.push('Акцент на практических примерах и пользе.');

  if (parts.length === 0) return null;

  return `=== ЦЕЛЕВАЯ АУДИТОРИЯ ===
${parts.join('\n')}
Это влияет на лексику, примеры и стиль. Не меняет структуру и SEO-правила.`;
}

function buildGeoBlock(geoLocation: string, geoMentions: number): string {
  if (!geoLocation) {
    return `=== ГЕО ===
Регион: вся Россия. Не привязывай текст к конкретному городу или региону.`;
  }
  return `=== ГЕО ===
Регион: ${geoLocation}
Упоминаний: ${geoMentions}
Обязательно: первые 500 символов + заключение. Допустимо в 1 H2.
Город и регион не в одном предложении.
LSI должны учитывать гео. Гео не в alt картинок (если не часть ключа).`;
}

function buildFaqBlock(faqCount: number, charCount: number, intent: string): string {
  if (faqCount === 0) {
    return `=== FAQ ===
FAQ-блок не нужен. Не добавляй раздел с вопросами.`;
  }

  // По E-E-A-T документу: 1 вопрос на 2000 символов, макс 10
  const eeatFaqCount = Math.min(10, Math.max(2, Math.floor(charCount / 2000)));
  const actualCount = Math.min(faqCount, eeatFaqCount);
  const faqChars = actualCount * 200;

  const FAQ_INTENT_TOPICS: Record<string, string> = {
    informational: 'уточняющие вопросы, исключения из правил, частые заблуждения',
    educational: 'что делать если пошло не так, альтернативные способы, типичные ошибки',
    commercial: 'цена, сроки, гарантии, отличия от конкурентов, условия возврата',
    comparative: 'для каких задач подходит каждый вариант, что лучше в конкретной ситуации',
    review: 'где купить, как проверить подлинность, на что обратить внимание',
    news: 'что это значит для читателя, что будет дальше, как влияет на отрасль',
    problem_solution: 'почему не помогло, когда нужен специалист, сколько времени займёт',
  };
  const intentTopics = FAQ_INTENT_TOPICS[intent] ?? FAQ_INTENT_TOPICS.informational;

  return `=== FAQ (10% от статьи, ~${faqChars} символов) ===

Количество: ${actualCount} вопросов. Формат: H2 "Часто задаваемые вопросы", каждый вопрос — H3.
Один вопрос + ответ = ~200 символов. FAQ идёт после заключения.

Темы вопросов для интента "${intent}": ${intentTopics}

Правила:
- Каждый вопрос уникален — не пересекается с основным текстом.
- Вопрос = реальный поисковый запрос: не «Что такое X?» а «Как выбрать X для малого бизнеса?»
- Ответ: 1-3 предложения максимум. Первое — прямой ответ. Второе — факт или цифра.
- Вопросы НЕ повторяют H2-заголовки статьи.
- Первый вопрос — самый популярный запрос по теме, не вошедший в структуру.
- Запрещены вопросы ради объёма: «Почему это важно?», «Стоит ли попробовать?»
- Каждый вопрос закрывает отдельное микронамерение: цена, сроки, ошибки, исключения.
- Максимум 1 вопрос содержит основной ключ, остальные — без ключа.`;
}

function buildImagesBlock(imageCount: number, brief: BriefData, imageStyles?: string[]): string {
  const h2Descriptions = (brief.h2_list ?? []).map((h2, i) => 
    `  H2 #${i + 1} "${h2.text}": ${h2.thesis ?? 'нет тезиса'}`
  ).join('\n');

  // Маппинг стилей на описания для промпта
  const STYLE_DESCRIPTIONS: Record<string, string> = {
    'realistic': 'фотореалистичная профессиональная фотография, студийный свет, высокая детализация, натуральные текстуры',
    'abstract': 'абстрактная композиция, геометрические формы, яркие контрастные цвета, креативные паттерны',
    '3d': 'яркие сочные цвета в стиле 3D с мягкими плавными будто надутыми формами, объёмные элементы, мягкие тени, трендовый 3D-рендер 2026 года',
    'minimalism': 'минималистичная композиция, много белого пространства, 2-3 цвета максимум, чистые линии, только ключевые объекты без лишних деталей',
    'illustrations': 'digital-иллюстрация, яркие цвета, рисованный стиль, editorial illustration, лёгкий штрих, как в журнальной графике',
  };

  // Комбинации стилей
  const STYLE_COMBOS: Record<string, string> = {
    '3d+minimalism': 'яркие сочные цвета в стиле 3D с мягкими надутыми формами, минималистичная композиция без лишних элементов — только главный объект темы на чистом фоне',
    '3d+abstract': '3D-рендер с абстрактными геометрическими формами, яркие градиенты, объёмные фигуры парящие в пространстве',
    '3d+illustrations': '3D-иллюстрация в мультяшном стиле, яркие мягкие формы, дружелюбный стиль как в Pixar',
    'minimalism+illustrations': 'минималистичный рисунок с яркими акцентными цветами, плоские формы, чистые линии, журнальная графика без перегруза',
    'minimalism+abstract': 'минималистичная абстракция, 2-3 геометрические формы, контрастные цвета на белом фоне',
    'abstract+illustrations': 'абстрактная иллюстрация, смелые цвета, свободные формы, экспрессивный штрих',
    'realistic+minimalism': 'фотореалистичный объект на чистом белом фоне, минимум деталей, студийная съёмка в стиле Apple',
    'realistic+3d': 'гиперреалистичный 3D-рендер, фотографическое качество, мягкие тени, студийный свет',
  };

  const styles = (imageStyles ?? ['realistic']).map(s => s.toLowerCase());
  
  let styleDescription: string;
  if (styles.length === 2) {
    const comboKey = styles.sort().join('+');
    styleDescription = STYLE_COMBOS[comboKey] ?? `${STYLE_DESCRIPTIONS[styles[0]] ?? styles[0]}, ${STYLE_DESCRIPTIONS[styles[1]] ?? styles[1]}`;
  } else {
    styleDescription = STYLE_DESCRIPTIONS[styles[0]] ?? styles[0];
  }

  return `=== ИЗОБРАЖЕНИЯ ===
Количество: ${imageCount}
Вставь ровно ${imageCount} маркеров [IMAGE_N] (N от 1 до ${imageCount}).
После каждого маркера на следующей строке: [IMAGE_N_DESC: развёрнутое описание сцены]

СТИЛЬ ИЗОБРАЖЕНИЙ: ${styleDescription}
Каждое описание ОБЯЗАТЕЛЬНО включает стилевые указания из строки выше. Описание без стиля — брак.

ПРАВИЛА ОПИСАНИЙ:
- Описание = 2-3 предложения на русском языке, привязанных к КОНКРЕТНОМУ разделу.
- Каждое описание УНИКАЛЬНО — разные объекты, ракурсы, композиция.
- Описывай КОНКРЕТНУЮ сцену по теме раздела: какие объекты, как расположены, какое действие.
- НЕ описывай телефоны, ноутбуки, экраны приложений — если тема не про технику. Описывай сам предмет статьи.
- Если тема "сравнение X и Y" — описывай X и Y рядом с визуальным разделителем (vs, стрелки, весы).
- Если тема "как работает X" — описывай процесс X в действии, не экран с интерфейсом.
- Если тема "виды X" — описывай коллаж или сетку из разных видов X.
- Заканчивай каждое описание фразой про стиль: "в стиле ${styles.join(' + ')}".

Контекст разделов для привязки изображений:
${h2Descriptions}

Расстановка:
- Первый маркер — сразу после H1, перед вводным абзацем. Обложка статьи — самое общее изображение по теме.
- Остальные — равномерно по H2-блокам. Каждое иллюстрирует КОНКРЕТНЫЙ аспект раздела.
- Минимум 1500 символов между маркерами.
- Последний маркер — не позднее 800 символов до конца.`;
}

function buildBrandBlock(
  brand: string,
  charCount: number,
  brandMentions: number,
  brandDescription?: string,
  brandUrl?: string,
): string {
  let block = `=== БРЕНД ===
Бренд: ${brand}`;

  if (brandDescription) {
    block += `\nО компании: ${brandDescription}`;
    block += `\n\nБренд должен быть вплетён в нарратив как часть контекста. Не вставляй бренд отдельным предложением вида "Компания X — это...". Вместо этого упоминай бренд внутри предложений, которые несут полезную информацию:
Плохо: "Старбакс — интернет-магазин кофемашин с доставкой по России."
Хорошо: "В каталоге Старбакс представлены модели от 15 производителей, включая De'Longhi и Philips — с бесплатной доставкой по России."`;
  } else {
    block += `\n\nУпоминай бренд естественно внутри предложений с полезной информацией. Не выделяй бренд в отдельное рекламное предложение.`;
  }

  block += `\nУпоминаний: ${brandMentions}`;
  if (charCount <= 8000) {
    block += `\nПозиции: один H2-блок (не первый) + заключение.`;
  } else if (charCount <= 14000) {
    block += `\nПозиции: два H2-блока (не первый) + заключение.`;
  } else {
    block += `\nПозиции: три H2-блока (первое упоминание — не раньше 2-го H2) + заключение.`;
  }
  block += `\nНЕ упоминай бренд в первом абзаце (вводном). Первый абзац отвечает на запрос пользователя, не продвигает бренд.`;

  if (brandUrl) {
    block += `\nПервое упоминание бренда оберни в <a href='${brandUrl}' target='_blank'>${brand}</a>. Остальные — plain text.`;
  }

  block += `\nНе в H1 (если не часть ключа). Допустим в 1 H2. Не рядом с ключом. Не в FAQ.`;
  return block;
}

function buildCtaBlock(
  cta: string,
  intent: string,
  ctaUrl?: string,
): string {
  let block = `=== CTA ===
Текст CTA: ${cta}`;

  if (ctaUrl) {
    block += `\nСсылка: оберни ключевую фразу призыва в <a href='${ctaUrl}' target='_blank'>текст призыва</a>.`;
  }

  const commercial = intent === 'commercial' ? ' + мини-CTA на 60% текста' : '';
  block += `\nПозиция: отдельный абзац после заключения${commercial}.
Объём: 150-400 символов. НЕ входит в целевой объём. Не содержит доп.ключей.

CTA должен быть естественным продолжением заключения, а не рекламной вставкой.
Плохо: "Заходите на наш сайт и покупайте! Скидки ждут вас!"
Хорошо: "Если выбор кофемашины вызывает вопросы — подберите модель под ваш бюджет в каталоге, где каждая карточка содержит сравнение характеристик и реальные отзывы покупателей."

Используй текст CTA от пользователя как основу, адаптируя под стиль статьи и логику заключения.`;
  return block;
}

function buildInternalLinksBlock(
  links: Array<{ url: string; anchor: string }>,
): string {
  const linkLines = links
    .map((l) => `- ${l.url} → анкор: "${l.anchor}"`)
    .join('\n');

  return `=== ПЕРЕЛИНКОВКА (ссылки на свои страницы) ===
Ссылки для вставки:
${linkLines}

Цель: каждая ссылка — это ответ на вопрос читателя, который естественно возникает в контексте абзаца.

Правила встраивания:
- Ссылка должна быть частью предложения, которое имеет смысл и без неё.
- Анкор — часть текста предложения, не отдельная фраза "читайте тут" или "подробнее здесь".
- Ставь ссылку в момент, когда тема абзаца пересекается с анкором.

Плохо: "Подробнее о выборе мощности читайте тут."
Хорошо: "Методику подбора мощности под площадь помещения мы разобрали в <a href='URL' target='_blank'>отдельном гайде</a> — там же калькулятор для расчёта."

Ограничения:
- Формат: <a href="URL" target="_blank">анкор</a>
- Не более 1 ссылки на H2-блок.
- Первая ссылка — не раньше 2-го абзаца.
- Не в предложении с ключевым словом.
- Не в FAQ, не в CTA, не в заключительном абзаце.
- Ссылка бренда считается в общий лимит.
- Минимум 500 символов между двумя ссылками. Две ссылки в одном абзаце — запрещено.
- Распределяй ссылки равномерно по тексту, не скапливай в конце.`;
}

function buildSourceLinksBlock(
  links: Array<{ url: string; anchor: string }>,
  charCount: number,
): string {
  const linkLines = links
    .map((l) => `- ${l.url} → анкор: "${l.anchor}"`)
    .join('\n');

  return `=== ССЫЛКИ НА ИСТОЧНИКИ ===
Ссылки на авторитетные внешние ресурсы:
${linkLines}

Назначение: каждая ссылка подкрепляет факт, цифру или утверждение в тексте. Ставится рядом с конкретным фактом как подтверждение.

Правила:
- Формат: <a href="URL" target="_blank">анкор</a>
- Ссылка ставится в конце предложения с фактом или данными, которые она подтверждает.
- Анкор — название источника или краткое описание: "по данным РБК", "исследование Data Insight".
- Не ставить ссылку на источник в предложении без конкретных данных.
- Не в FAQ, не в CTA, не в блоке «Кратко».
- Минимум 800 символов между двумя ссылками на источники.
- Источники не дублируют перелинковку — это разные типы ссылок.`;
}

function buildForbiddenWordsBlock(forbiddenWords: string): string {
  return `=== ЗАПРЕЩЁННЫЕ СЛОВА ===
Ни одно из этих слов не должно появиться в тексте:
${forbiddenWords}

Запрет распространяется на все формы слова: морфоформы, однокоренные, уменьшительные.
Пример: если запрещено "дешёвый" — нельзя использовать "дешевле", "дешевизна", "дёшево", "недешёвый".
Пример: если запрещено "китайский" — нельзя "китайская", "китайского", "по-китайски".

Если запрещённое слово критично для раскрытия темы — используй синоним или описательную конструкцию.`;
}

function buildLegalBlock(legalRestrictions: string): string {
  return `=== ЮРИДИЧЕСКИЕ ОГРАНИЧЕНИЯ ===
Ограничение высшего приоритета: ${legalRestrictions}

Дисклеймер перед CTA должен быть конкретным и полезным для читателя, а не формальной отпиской.
Плохо: "Данная статья не является рекомендацией."
Хорошо (медицина): "Информация носит ознакомительный характер и не заменяет консультацию врача. Перед началом лечения обратитесь к специалисту."
Хорошо (финансы): "Доходность в прошлом не гарантирует результатов в будущем. Перед инвестированием оцените свой риск-профиль."

Формат дисклеймера: отдельный абзац перед CTA, 1-2 предложения.`;
}

function buildEeatBlock(intent: string, targetQuery: string, charCount: number): string {
  const factsCount = Math.max(2, Math.floor(charCount / 1500));
  const queryLower = targetQuery.toLowerCase();

  const isRegulated = /медицин|здоров|лечени|врач|препарат|лекарств|диагноз|симптом|болезн|финанс|инвестиц|кредит|ипотек|налог|страхов|вклад|акци|банк|юрид|закон|право|суд|договор|штраф|лицензи|строительств|ремонт|электрик|безопасност/i.test(queryLower);

  const isCommerce = /купить|заказать|цена|стоимость|магазин|маркетплейс|доставк|покупк/i.test(queryLower)
    || intent === 'commercial' || intent === 'review' || intent === 'comparative';

  let block = `=== E-E-A-T И ЖИВЫЕ ФАКТЫ ===

В статье должно быть минимум ${factsCount} проверяемых фактов. Факт = конкретная цифра, дата, название, источник, событие.

EXPERIENCE (Опыт — пиши как практик):
- Фразы "на практике", "по опыту", "при тестировании оказалось", "мы проверили".
- Минимум 1 конкретный кейс или пример на каждые 2000 символов.
- Описывай процесс от первого лица или как наблюдатель: "при первом заказе оказалось, что...", "на этапе оплаты возникает нюанс...".

EXPERTISE (Экспертиза — профессиональные детали):
- Точные параметры вместо обобщений: не "высокая производительность", а "обработка 1 200 запросов в секунду при пиковой нагрузке".
- Профессиональная терминология с объяснением: "латентность (задержка между запросом и ответом сервера)".`;

  if (isRegulated) {
    block += `
- Ссылайся на РЕАЛЬНЫЕ законы и нормативы: ФЗ, ГОСТы, СНиПы, постановления. Не выдумывай номера — если не помнишь точный, пиши "согласно действующему законодательству РФ".
- Актуальные цифры: ставки, лимиты, пороги, сроки из действующего законодательства.`;
  }

  block += `

AUTHORITATIVENESS (Авторитетность — ссылки на источники):
- Упоминай реальные источники: "по данным РБК", "согласно исследованию Data Insight", "статистика Росстата", "отчёт Центробанка".
- Для коммерческих тем: реальные площадки, рейтинги, обзоры ("по рейтингу Яндекс.Маркета", "на Отзовике средняя оценка 4.3").`;

  if (isCommerce) {
    block += `
- Сравнивай с конкурентами конкретно: не "дешевле аналогов", а "на 15-30% дешевле при сравнении 10 позиций с тремя конкурентами".
- Указывай реальные ценовые диапазоны с привязкой к источнику и дате.`;
  }

  block += `

TRUSTWORTHINESS (Доверие — честность и актуальность):
- Актуальность: "по актуальным данным", "обновлено в текущем месяце".
- НЕ скрывай минусы и ограничения — это повышает доверие. "Минус: интерфейс только на китайском", "Ограничение: порог беспошлинного ввоза — 200 евро".
- Если данные могут устареть — предупреди: "курс может измениться", "условия актуальны на момент публикации".

=== КАК РАБОТАТЬ С ЦИФРАМИ И ФАКТАМИ ===

Любая цифра в статье относится к одному из трёх уровней. Определи уровень ПЕРЕД тем как написать.

УРОВЕНЬ 1 — ТОЧНЫЙ ФАКТ (знаешь источник):
Шаблон: "[цифра] по данным [источник] за [год]"
Пример: "45% контрафакта приходится на Китай по данным OECD за 2021 год"
Пример: "выручка составила $8.9 млрд согласно отчёту компании за 2023 год"

УРОВЕНЬ 2 — ПРИБЛИЗИТЕЛЬНЫЙ ФАКТ (знаешь порядок, но не точное число):
Шаблон: "[диапазон/порядок] по оценкам [кого]"
Пример: "оценка компании превышает $1 млрд по данным инвесторов"
Пример: "десятки миллионов активных пользователей ежемесячно"
НЕ ПИШИ: "$10 млрд", "300 миллионов пользователей" — если не можешь назвать источник, снижай до диапазона.

УРОВЕНЬ 3 — ИЛЛЮСТРАТИВНЫЙ ПРИМЕР (выдуманный для наглядности):
Шаблон: "допустим, [ситуация]" / "представим: [ситуация]"
Пример: "допустим, вы заказали кроссовки за ¥800 — с доставкой и комиссией выйдет около 14 000 рублей"
НИКОГДА не выдавай уровень 3 за уровень 1. Читатель должен видеть что это пример, а не статистика.

ГЛАВНОЕ ПРАВИЛО: если не можешь назвать источник конкретной цифры — понижай уровень. Точная цифра без источника хуже, чем честный диапазон.`;

  return block;
}

function buildIntroTldrBlock(profile: ArticleProfile): string {
  return `=== ВВЕДЕНИЕ + БЛОК «КРАТКО» (6% от статьи) ===

ВВЕДЕНИЕ (~${profile.intro} символов):
- Первое предложение — главный ключ вписан естественно, не в лоб.
- Второе-третье предложение — проблема читателя, зачем он пришёл.
- Последнее предложение — что конкретно узнает из статьи. БЕЗ фразы «в этой статье мы расскажем».
- Максимум 1 главный ключ + 1 LSI на весь блок введения + блок «Кратко».
- Запрещено: общие фразы («все знают что...»), вода («данная тема очень актуальна»), повтор H1 своими словами.

БЛОК «КРАТКО» (~${profile.tldr.chars} символов):
Сразу после введения. Формат HTML — используй только базовые теги без div:
<p><strong>Кратко</strong></p>
<ul><li>пункт 1</li><li>пункт 2</li></ul>

КРИТИЧНО:
- «Кратко» — это НЕ заголовок. НЕ используй H2 или H3 для слова «Кратко». Только <p><strong>Кратко</strong></p>. Это стилевой элемент, не структурный заголовок.
- ЗАПРЕЩЕНО писать "TL;DR", "TL;DR:", "TLDR". Только русское слово «Кратко». Использование латинского "TL;DR" — брак.

- ${profile.tldr.items} пунктов максимум. Каждый — одно предложение, одна мысль, одна цифра или факт.
- Ключи не вставляются специально.
- Запрещены пункты без конкретики: «это важно знать» — не считается.`;
}

function buildTableBlock(profile: ArticleProfile, brief: BriefData): string {
  const tableAfterH2 = brief.table_after_h2 ?? 1;
  const tableTopic = brief.table_topic ?? 'сравнение ключевых характеристик по теме';

  return `=== БЛОК СРАВНЕНИЯ (4% от статьи, ~${profile.comparison.chars} символов) ===

Один блок сравнения в статье. Размести внутри H2 #${tableAfterH2 + 1} (считая от начала).
Тема сравнения: ${tableTopic}

Количество объектов сравнения: ${profile.comparison.objects}. Критериев на каждый: ${profile.comparison.criteria}.
Первым всегда ставь основной объект статьи (из target_query). Остальные — конкуренты.

Формат HTML — НЕ используй H3 для объектов сравнения. Название объекта через bold-абзац, под ним список:
<p><strong>Объект 1</strong></p>
<ul><li><strong>Критерий:</strong> значение</li><li><strong>Критерий:</strong> значение</li></ul>
<p><strong>Объект 2</strong></p>
<ul><li><strong>Критерий:</strong> значение</li><li><strong>Критерий:</strong> значение</li></ul>

ЗАПРЕЩЕНО использовать H3 или H4 для названий объектов сравнения. Только <p><strong>Название</strong></p>.
ЭТО АБСОЛЮТНЫЙ ЗАПРЕТ. Если в блоке сравнения появится хоть один H3 — весь блок считается браком. Проверь себя: между заголовком H2 раздела и концом блока сравнения не должно быть ни одного тега <h3>.

Правила:
- Данные в значениях конкретные: числа, сроки, цены — не «хорошо/плохо».
- Если блок сравнения можно убрать без потери смысла — он не нужен. Сделай его полезным.

ФАКТ-ЧЕК СРАВНЕНИЯ:
- Все цифры в сравнении должны быть реалистичными и проверяемыми.
- Не выдумывай характеристики конкурентов. Если не знаешь точных данных — пиши диапазон или "по последним данным".
- Не приписывай конкурентам несуществующие недостатки ради выгодного сравнения.`;
}

function buildCaseBlock(profile: ArticleProfile, brief: BriefData): string {
  const caseTopic = brief.case_topic ?? 'практический опыт по теме статьи';

  if (profile.case.style === 'short') {
    return `=== ЛИЧНЫЙ ОПЫТ / КЕЙС (~${profile.case.chars} символов) ===\nКороткий кейс в 2-3 предложения: конкретная ситуация + результат с цифрой. Без подробного разбора. Тема: ${caseTopic}`;
  }

  return `=== ЛИЧНЫЙ ОПЫТ / КЕЙС (~${profile.case.chars} символов) ===

Размести в основном тексте после таблицы сравнения. Тема кейса: ${caseTopic}

Структура блока:
1. Контекст — кто, когда, в каких условиях: «Мы тестировали X...»
2. Проблема — с чем столкнулись: «До этого использовали Y, но конверсия падала на 3%...»
3. Действие — что конкретно сделали: «Изменили структуру, добавили Z, запустили A/B тест...»
4. Результат с цифрами — без цифр это не кейс: «Конверсия выросла с 1.8% до 3.2%...»
5. Вывод — что это значит для читателя: «Работает если у вас X, не сработает если Y...»

Правила:
- Цифры обязательны: дата, процент, срок, бюджет, количество.
- Конкретный контекст: не «один клиент», а «интернет-магазин из Москвы с 200 SKU».
- Признай что пошло не так — одна ошибка добавляет доверие.
- Не повторяй то что уже написано в основном тексте.

Формат: обычные абзацы <p>, без специальной обёртки.`;
}

function buildCitationsBlock(profile: ArticleProfile): string {
  const count = profile.citations.count;

  return `=== ЦИТАТЫ ЭКСПЕРТОВ (встроены в основной текст) ===

Количество: ${count} ${count === 1 ? 'цитата' : 'цитаты'}. Встроены в тело статьи, не отдельным блоком.

Формат HTML для цитат экспертов (НЕ путать с callout-блоками):
<blockquote><p>Текст цитаты эксперта — без strong, без эмодзи, без заголовка</p><cite>Имя Фамилия, должность, источник</cite></blockquote>

ОТЛИЧИЕ ОТ CALLOUT: цитата эксперта НЕ содержит strong-заголовок и эмодзи. Если внутри blockquote есть <strong> с эмодзи — это callout, не цитата.

Правила:
- Цитата говорит то, что автор сам сказать не может — мнение, инсайд, опыт эксперта.
${count >= 2 ? '- Две цитаты от РАЗНЫХ людей: разные точки зрения = доверие.' : ''}
- Максимум 2-3 предложения — короткая и точная.
- НЕ ставить в первые 500 символов статьи.
- Одно предложение ДО цитаты объясняет зачем она, одно ПОСЛЕ — что из неё следует.
- Формат cite: имя, должность, где было сказано (интервью, книга, конференция).
- Цитаты должны быть реалистичными. Если не знаешь точную цитату — сформулируй как «по словам эксперта отрасли» без выдумывания конкретного имени.`;
}

function buildCalloutBlock(profile: ArticleProfile): string {
  return `=== CALLOUT-БЛОКИ (встроены в основной текст, ~6%) ===

Количество: ${profile.callout.count} блоков. Каждый ~${profile.callout.charsEach} символов (50-120 символов).

Типы:
- Важно — критическая информация
- Совет — практическая рекомендация
- Предупреждение — риски, ошибки
- Пример — кейс или иллюстрация

Формат HTML — используй blockquote вместо div (совместимо с Tilda, Google Docs, Word):
<blockquote><p><strong>⚠️ Предупреждение</strong><br><em>Текст 50-120 символов</em></p></blockquote>
<blockquote><p><strong>💡 Совет</strong><br><em>Текст 50-120 символов</em></p></blockquote>
<blockquote><p><strong>❗ Важно</strong><br><em>Текст 50-120 символов</em></p></blockquote>

КРИТИЧНО: внутри blockquote строго один тег p. Заголовок и текст разделяются через br, не через два отдельных p.

Типы различаются эмодзи в заголовке: ⚠️ предупреждение, 💡 совет, ❗ важно, 📌 пример.

Правила:
- Один callout на H2-блок максимум. Не ставить два подряд.
- Callout НЕ дублирует текст рядом — добавляет новую мысль.
- Заголовок — одно слово с эмодзи: «⚠️ Предупреждение», «💡 Совет», «❗ Важно», «📌 Пример».`;
}

function buildAuthorBlock(input: Record<string, unknown>): string | null {
  const name = (input.author_name as string) ?? '';
  const position = (input.author_position as string) ?? '';
  const company = (input.author_company as string) ?? '';
  const url = (input.author_url as string) ?? '';
  const date = (input.publication_date as string) ?? '';

  if (!name && !company) return null;

  let block = `=== БЛОК АВТОРА (E-E-A-T) ===
Сразу после H1 вставь блок автора в формате HTML:
`;

  if (name) {
    const nameHtml = url ? `<a href="${url}" target="_blank" rel="noopener">${name}</a>` : name;
    block += `\n<p><strong>${nameHtml}${position ? `, ${position}` : ''}${company ? ` — ${company}` : ''}</strong></p>`;
  } else if (company) {
    block += `\n<p><strong>${company}</strong></p>`;
  }

  if (date) {
    block += `\n<p><em>Опубликовано: ${date}</em></p>`;
  }

  block += `

Блок автора НЕ считается в объём статьи. Это технический элемент.
В тексте статьи пиши от лица этого автора/компании где уместно.`;

  return block;
}

function buildTocBlock(_brief: BriefData): string | null {
  return null;
}

function buildAntiSpamBlock(charCount: number, mainKeyword: string): string {
  const maxRepeat = charCount <= 6000 ? 4 : charCount <= 10000 ? 6 : 8;
  const maxBrandTotal = charCount <= 6000 ? 8 : charCount <= 10000 ? 12 : 16;
  return `=== АНТИСПАМ (КРИТИЧНО — НЕСОБЛЮДЕНИЕ = БРАК) ===

Заспамленность — главный враг SEO и читабельности.

ПРАВИЛА:
1. Ни одно значимое слово (>3 букв) не должно повторяться более ${maxRepeat} раз во всём тексте. Пересчитай перед финализацией.
2. Название продукта/бренда/сервиса (все формы написания: латиница + кириллица + транслитерация) — суммарно не более ${maxBrandTotal} раз.
3. Основной ключ "${mainKeyword}" входит в этот лимит. Не дублируй ключ и бренд в одном предложении.
4. Если ключевое слово нужно в FAQ — используй 1 раз максимум, остальные FAQ без ключа.
5. ОБЯЗАТЕЛЬНО используй синонимы и описательные конструкции вместо повторов. Для любого существительного в тексте должно быть 2-3 синонима которые чередуются.
6. Каждое слово с повтором >${maxRepeat} = переспам = брак.
7. Родовые синонимы (платформа/сервис/инструмент/решение/система) — чередуй все варианты. Не используй одно из них более ${Math.ceil(maxRepeat * 0.7)} раз.
8. В заголовках H2 и H3 не повторяй одни и те же слова. Если слово есть в H1 — максимум в 2 других заголовках.
9. Перед финализацией пересчитай топ-10 самых частых значимых слов. Если любое превышает лимит — замени на синоним.`;
}

function buildAntiDetectBlock(tone: string): string {
  return `=== АНТИДЕТЕКТ (КРИТИЧНО — НЕСОБЛЮДЕНИЕ = БРАК) ===

Ты должен писать так, чтобы текст был НЕОТЛИЧИМ от написанного живым человеком-экспертом. AI-детекторы анализируют паттерны, которые типичны для нейросетей. Твоя задача — ломать эти паттерны.

ОБЯЗАТЕЛЬНЫЕ ТЕХНИКИ (применять в КАЖДОМ абзаце):

1. РВАНЫЙ РИТМ ПРЕДЛОЖЕНИЙ.
Длина предложений в каждом абзаце должна скакать хаотично.
Плохо: "Сервис работает с 2015 года. Компания обрабатывает миллионы заказов. Пользователи получают гарантию качества." (3 предложения по 5-7 слов)
Хорошо: "Сервис запустили шесть лет назад. За это время — больше 50 миллионов пользователей из 180 стран, если верить отчёту для инвесторов. Цифра впечатляет."

2. РАЗНЫЕ НАЧАЛА АБЗАЦЕВ.
Запрещено начинать 2+ абзаца подряд с одной и той же конструкции.
Чередуй: голый факт ("За последний год..."), вопрос ("Зачем переплачивать?"), действие ("Откройте приложение..."), короткое утверждение ("Это работает."), число ("73% покупателей...").

3. КОНКРЕТИКА ВМЕСТО ВОДЫ.
Каждый абзац содержит минимум 1 элемент: число, дату, название, пример, сравнение.
Плохо: "Платформа обеспечивает высокий уровень безопасности."
Хорошо: "За последний год система обработала 1.5 миллиона заявок — из них 3.2% отклонены на этапе проверки."

4. ЧЕЛОВЕЧЕСКИЕ ВСТАВКИ.
${tone !== 'scientific' && tone !== 'business' ? 'На каждые 1500 символов — минимум 1 элемент: риторический вопрос, разговорный оборот ("если честно", "на практике"), обращение к читателю, короткий личный пример или мини-история.' : 'На каждые 2000 символов — минимум 1 элемент: практический пример, кейс, сравнение с конкурентом.'}

5. НЕРАВНОМЕРНЫЕ H2-БЛОКИ.
Длина H2-блоков должна отличаться минимум на 40%. Один блок — 600 символов, следующий — 1000. AI пишет блоки одинаковой длины — ты нет.

ЗАПРЕЩЁННЫЕ КОНСТРУКЦИИ (использование = брак):
"В настоящее время", "Стоит отметить", "Как известно", "На сегодняшний день", "Важно отметить", "Следует подчеркнуть", "Необходимо учитывать", "Таким образом", "Давайте разберёмся", "Не секрет, что", "В современном мире", "Хочется отметить", "Как показывает практика", "В рамках данного", "В данном контексте", "Подводя итог".

Также запрещены фразы-филлеры в начале предложений: "Кроме того", "Более того", "Помимо этого", "Вместе с тем", "При этом", "В свою очередь", "Безусловно", "Несомненно".

ПРИМЕРЫ ЦЕЛОГО АБЗАЦА:

Плохо (AI-стиль):
"Платформа предоставляет широкий ассортимент товаров. Пользователи могут выбирать из множества категорий. Система верификации обеспечивает гарантию подлинности. Важно отметить, что каждый товар проходит тщательную проверку."

Хорошо (человеческий стиль):
"В каталоге — больше 50 000 позиций от 300 производителей. Техника, расходники, аксессуары. Каждый заказ проходит 4 этапа проверки: от сверки артикула до тестового запуска. Что если товар бракованный? Возврат за 3 дня без вопросов."`;
}

const READABILITY_BLOCK = `=== ЧИТАБЕЛЬНОСТЬ ===
- Максимум 25 слов в предложении (35 — абсолютный потолок для сложных тем).
- Максимум 5 предложений в абзаце.
- Не более 2 сложноподчинённых предложений подряд.
- Избегай слов длиннее 15 букв. Замени на короткие синонимы: "аутентифицированный" → "проверенный", "специализирующийся" → "работающий с", "сертифицированный" → "с сертификатом".
- Если термин длинный и незаменимый — используй его 1 раз и далее сокращай: "аутентификация" → "проверка", "верификация" → "проверка подлинности" → далее просто "проверка".`;

const FORMAT_EXAMPLE_BLOCK = `=== ПРИМЕР ФОРМАТА ===
Ниже — образец H2-блока со всеми типами элементов. Это демонстрация ТОЛЬКО структуры и HTML-разметки. НЕ копируй содержание, цифры и названия из примера — они выдуманы для демонстрации.

<h2>Заголовок второго уровня</h2>
<p>Первый абзац раздела с вводной информацией. Здесь 2-3 предложения, которые вводят в тему раздела. Конкретные цифры и факты вместо общих фраз.</p>
<blockquote><p><strong>💡 Совет</strong><br><em>Текст callout-блока — короткий практический совет для читателя</em></p></blockquote>
<h3>Подзаголовок третьего уровня</h3>
<p>Абзац с деталями. Минимум 300 символов между заголовками. Конкретика: цифры, сроки, названия.</p>
<blockquote><p>Цитата эксперта — одно-два предложения с конкретным фактом или наблюдением</p><cite>Имя Фамилия, должность, источник</cite></blockquote>
<p>Переходный абзац с вопросом или выводом по подразделу.</p>
<p><strong>Сравнение вариантов</strong></p>
<p><strong>Вариант A</strong></p>
<ul><li><strong>Критерий 1:</strong> значение</li><li><strong>Критерий 2:</strong> значение</li></ul>
<p><strong>Вариант B</strong></p>
<ul><li><strong>Критерий 1:</strong> значение</li><li><strong>Критерий 2:</strong> значение</li></ul>

ВАЖНО: это шаблон разметки. Содержание, цифры, названия бери из ТЗ и темы статьи, НЕ из этого примера.`;

export function buildSystemPrompt(
  input: Record<string, unknown>,
  brief: BriefData,
): string {
  const currentYear = new Date().getFullYear();
  const blocks: string[] = [];

  const charCount = (input.target_char_count as number) ?? 8000;
  const imageCount = (input.image_count as number) ?? 0;
  const faqCount = (input.faq_count as number) ?? 5;
  const intent = (input.intent as string) ?? 'informational';
  const tone = (input.tone_of_voice as string) ?? 'expert';
  const toneComment = (input.tone_comment as string) ?? '';
  const geo = (input.geo_location as string) ?? '';
  const brand = (input.brand as string) ?? '';
  const brandUrl = input.brand_url as string | undefined;
  const brandDescription = input.brand_description as string | undefined;
  const cta = (input.cta as string) ?? '';
  const ctaUrl = input.cta_url as string | undefined;
  const keywords = (input.keywords as string) ?? '';
  const forbiddenWords = (input.forbidden_words as string) ?? '';
  const legalRestrictions = (input.legal_restrictions as string) ?? '';
  const internalLinks = (input.internal_links as Array<{ url: string; anchor: string }>) ?? [];
  const sourceLinks = (input.source_links as Array<{ url: string; anchor: string }>) ?? [];
  const audience = input.target_audience as
    | { gender: string; age: string[] }
    | undefined;
  const gender = audience?.gender ?? 'all';
  const ages = audience?.age ?? ['all'];

  const comparisonEnabled = (input.comparison_enabled as boolean) ?? false;
  const comparisonObjects = (input.comparison_objects as number) ?? 3;
  const comparisonCriteria = (input.comparison_criteria as number) ?? 3;

  const h2Count = brief.h2_list?.length || Math.round(charCount / 2000);
  const profile = getArticleProfile(charCount, faqCount, comparisonEnabled, comparisonObjects, comparisonCriteria);

  const readingTime = Math.max(2, Math.round(charCount / 1700));
  const bodyIncludes = comparisonEnabled ? 'таблицу, кейс, цитаты, callout' : 'кейс, цитаты, callout';

  // === ПОРЯДОК БЛОКОВ ПО E-E-A-T ДОКУМЕНТУ ===

  // 1. Роль и задача
  blocks.push(ROLE_BLOCK);

  blocks.push(`=== ТЕКУЩИЙ ГОД ===
Сегодня: ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}. Текущий год: ${currentYear}.
КРИТИЧНО: если упоминаешь год в тексте — используй ТОЛЬКО ${currentYear}. Год ${currentYear - 1} или ${currentYear - 2} допустимы ТОЛЬКО для описания прошлых событий с явным контекстом ("в прошлом году", "по итогам ${currentYear - 1} года").
Запрещено: ставить год ${currentYear - 2} или старше в контексте актуальных данных, цен или статистики.`);

  // 2. Объём и бюджет
  blocks.push(buildVolumeBlock(charCount));
  blocks.push(buildBudgetBlock(charCount, h2Count, profile));

  // 3. Порядок блоков в статье (главная инструкция)
  blocks.push(`=== ПОРЯДОК БЛОКОВ В СТАТЬЕ ===
Строго соблюдай этот порядок. Не переставляй блоки.

1. H1 — заголовок
${input.author_name || input.author_company ? '2. Блок автора (имя, должность, компания)' : ''}
3. Время чтения: «Время прочтения статьи: ${readingTime} минут» — формат: <p><em>Время прочтения статьи: ${readingTime} минут</em></p>
${imageCount > 0 ? '4. Главная картинка [IMAGE_1]' : ''}
6. Введение (4%) + блок «Кратко» (2%)
7. Основной текст (H2-блоки) — включает ${bodyIncludes}
8. Заключение (H2) — отдельный раздел с выводом
9. FAQ (H2 + H3-вопросы внутри) — если пользователь включил FAQ. Вопросы FAQ как H3 не считаются в лимит H3 основных разделов.
${cta ? '10. CTA (после FAQ, отдельный абзац, не считается в объём)' : ''}`);

  // 4. Структура H2/H3
  blocks.push(buildStructureBlock(brief));

  // 5. Новые E-E-A-T блоки
  blocks.push(buildIntroTldrBlock(profile));

  const authorBlock = buildAuthorBlock(input);
  if (authorBlock) blocks.push(authorBlock);

  const tocBlock = buildTocBlock(brief);
  if (tocBlock) blocks.push(tocBlock);

  if (comparisonEnabled) blocks.push(buildTableBlock(profile, brief));
  blocks.push(buildCaseBlock(profile, brief));
  if (profile.citations.count > 0) {
    blocks.push(buildCitationsBlock(profile));
  }
  blocks.push(buildCalloutBlock(profile));

  // 6. SEO: ключи
  blocks.push(buildMainKeywordBlock(brief, imageCount, charCount));
  blocks.push(buildAdditionalKeysBlock(keywords, brief.keys_per_section, charCount));

  if (brief.lsi_keywords?.length) {
    blocks.push(buildLsiBlock(brief.lsi_keywords, charCount));
  }

  // 7. Стиль и аудитория
  blocks.push(buildIntentBlock(intent));
  blocks.push(buildToneBlock(tone, toneComment || undefined));

  const audienceBlock = buildAudienceBlock(gender, ages);
  if (audienceBlock) blocks.push(audienceBlock);

  blocks.push(buildGeoBlock(geo, brief.geo_mentions));

  // 8. FAQ
  blocks.push(buildFaqBlock(faqCount, charCount, intent));

  // 9. Заключение
  const conclusionChars = profile.conclusion;
  blocks.push(`=== ЗАКЛЮЧЕНИЕ (H2, 5% от статьи, ~${conclusionChars} символов) ===
Заголовок H2. Структура:
1. Главный вывод — одно предложение, суть всей статьи.
2. Что читатель должен сделать дальше — конкретный следующий шаг.
3. Призыв к действию — задать вопрос, скачать, попробовать.
Без воды и повторения того что уже сказано.`);

  // 10. Картинки
  if (imageCount > 0) {
    const imageStyles = (input.image_style as string[]) ?? [];
    blocks.push(buildImagesBlock(imageCount, brief, imageStyles));
  }

  // 11. Бренд, CTA, ссылки
  if (brand) {
    blocks.push(buildBrandBlock(brand, charCount, brief.brand_mentions, brandDescription, brandUrl));
  }

  if (cta) {
    blocks.push(buildCtaBlock(cta, intent, ctaUrl));
  }

  // Перелинковка (свои страницы + бренд)
  const intLinks: Array<{ url: string; anchor: string }> = [];
  if (brand && brandUrl) intLinks.push({ url: brandUrl, anchor: brand });
  intLinks.push(...internalLinks);
  if (intLinks.length > 0) {
    blocks.push(buildInternalLinksBlock(intLinks));
  }

  // Ссылки на источники
  if (sourceLinks.length > 0) {
    blocks.push(buildSourceLinksBlock(sourceLinks, charCount));
  }

  // Общий лимит ссылок
  const totalLinkCount = intLinks.length + sourceLinks.length;
  const maxTotalLinks = Math.floor(charCount / 2000);
  if (totalLinkCount > 0) {
    blocks.push(`=== ОБЩИЙ ЛИМИТ ССЫЛОК ===
В статье суммарно ${totalLinkCount} ссылок (перелинковка: ${intLinks.length}, источники: ${sourceLinks.length}${brand && brandUrl ? ', включая бренд' : ''}).
Максимум для ${charCount} символов: ${maxTotalLinks} ссылок (1 на 2000 символов).
${totalLinkCount > maxTotalLinks ? `ВНИМАНИЕ: превышен лимит. Расставь только ${maxTotalLinks} самых релевантных, остальные пропусти.` : 'Лимит не превышен.'}
Правило: между любыми двумя ссылками (независимо от типа) минимум 500 символов. Две ссылки в одном абзаце — запрещено.`);
  }

  // 12. Ограничения
  if (forbiddenWords) {
    blocks.push(buildForbiddenWordsBlock(forbiddenWords));
  }

  if (legalRestrictions) {
    blocks.push(buildLegalBlock(legalRestrictions));
  }

  // 13. Качество текста
  blocks.push(buildEeatBlock(intent, (input.target_query as string) ?? '', charCount));
  blocks.push(buildAntiSpamBlock(charCount, (input.target_query as string) ?? ''));
  blocks.push(buildAntiDetectBlock(tone));
  blocks.push(READABILITY_BLOCK);
  blocks.push(FORMAT_EXAMPLE_BLOCK);

  return blocks.join('\n\n');
}
