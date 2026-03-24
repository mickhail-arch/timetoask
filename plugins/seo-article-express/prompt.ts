import type { BriefData } from '@/modules/seo/types';

const ROLE_BLOCK = `=== РОЛЬ И ЗАДАЧА ===
Ты — профессиональный SEO-копирайтер. Пишешь чистовую статью на русском языке за один проход.
Формат вывода: HTML-теги (h1, h2, h3, p). Никаких других тегов внутри абзацев — без strong, em, b, i.
Если название бренда, платформы или сервиса имеет латинское написание — всегда используй латиницу (Poizon, не Пойзон; Dewu, не Дэву). Транслитерацию используй только если она является отдельным ключевым словом.`;

function buildVolumeBlock(charCount: number): string {
  const min = Math.round(charCount * 0.95);
  const max = Math.round(charCount * 1.05);
  return `=== ОБЪЁМ ===
Целевой объём: ровно ${charCount} символов чистого текста (без HTML-тегов). Допуск ±5%: от ${min} до ${max}.
Это жёсткое ограничение. Статья короче ${min} или длиннее ${max} символов — брак.`;
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
- Последние 300-500 символов — заключение без нового H2.`;
}

function buildBudgetBlock(
  charCount: number,
  h2Count: number,
  faqCount: number,
): string {
  const faqBudget = faqCount * 120;
  const remaining = charCount - 300 - 400 - faqBudget;
  const perH2 = Math.round(remaining / h2Count);

  let block = `=== БЮДЖЕТ СИМВОЛОВ ===
Вводный абзац: ~300 символов
Каждый H2-блок: ~${perH2} символов`;
  if (faqCount > 0) block += `\nFAQ-блок: ~${faqBudget} символов (~120 на вопрос+ответ)`;
  block += `\nЗаключение: ~400 символов
Сумма должна дать ${charCount} ±5%.`;
  return block;
}

function buildMainKeywordBlock(brief: BriefData, imageCount: number): string {
  let block = `=== ОСНОВНОЙ КЛЮЧ ===
Ключ: "${brief.main_keyword}"
Вхождений: от ${brief.main_keyword_min} до ${brief.main_keyword_max}.
Плотность: коридор 0.5-1.5%.

Обязательные точки вхождения:
1. H1 (точное или морфологическое)
2. Первые 300 символов текста (точное)
3. Один H2-заголовок (разбавленное)
4. Заключение (любая форма)`;
  if (imageCount > 0) block += `\n5. Alt первой картинки`;

  block += `

Формы: 30-40% точные, 60-70% морфологические.
Не реже 1 раз на 2500 символов, не чаще 1 раз на 1000.
Основной ключ в точной форме 2 раза в радиусе 500 символов — запрещено.`;
  return block;
}

function buildAdditionalKeysBlock(
  keywords: string,
  keysPerSection: number,
): string {
  return `=== ДОПОЛНИТЕЛЬНЫЕ КЛЮЧИ ===
Ключи:
${keywords}
Макс ключей на H2-блок: ${keysPerSection}

Распределение: равномерно по H2-блокам. Каждый ключ — 1-2 вхождения.
30-50% заголовков H2 содержат доп.ключ. H3 — не более 1 ключа.

Стоп-правила (нарушение = брак):
- Два ключа в одном предложении — запрещено.
- Ключ в первом слове после заголовка — запрещено.
- Ключ в конце абзаца + начале следующего подряд — запрещено.
- Один доп.ключ в двух заголовках — запрещено.`;
}

function buildLsiBlock(lsiKeywords: string[]): string {
  return `=== LSI-КЛЮЧИ ===
LSI: ${lsiKeywords.join(', ')}
Используй 2-4 уникальных LSI на каждые 2000 символов. Не дублируй с основными ключами.`;
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

function buildToneBlock(tone: string): string {
  const desc =
    TONE_MAP[tone] ??
    `Стиль текста: ${tone}. Следуй этому описанию стиля.`;
  return `=== СТИЛЬ ТЕКСТА ===
${desc}`;
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

function buildFaqBlock(faqCount: number): string {
  if (faqCount === 0) {
    return `=== FAQ ===
FAQ-блок не нужен. Не добавляй раздел с вопросами.`;
  }
  return `=== FAQ ===
Количество вопросов: ${faqCount}
Формат: H2 "Часто задаваемые вопросы", каждый вопрос — H3.
FAQ идёт после основного контента, перед CTA.

Правила:
- Вопрос: 5-10 слов, конкретный.
- Ответ: СТРОГО 2 предложения, 80-150 символов (не больше 150!). Первое предложение — прямой ответ. Второе — факт или число. Ответ длиннее 150 символов — брак.
- 1-2 вопроса содержат основной ключ.
- Последний H3 — это вопрос. Заключение и CTA идут ПОСЛЕ FAQ отдельно.
- FAQ входит в целевой объём статьи и занимает не более 10-15% от него.`;
}

function buildImagesBlock(imageCount: number): string {
  return `=== ИЗОБРАЖЕНИЯ ===
Количество: ${imageCount}
Вставь ровно ${imageCount} маркеров [IMAGE_N] (N от 1 до ${imageCount}).
После каждого маркера на следующей строке: [IMAGE_N_DESC: описание сцены на русском]

Расстановка:
- Первый маркер — сразу после H1, перед вводным абзацем. Формат: </h1>\n[IMAGE_1]\n[IMAGE_1_DESC: описание]\n<p>вводный текст...
- Остальные — равномерно по H2-блокам, привязка к началу H2.
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

function buildExternalLinksBlock(
  links: Array<{ url: string; anchor: string }>,
): string {
  const linkLines = links
    .map((l) => `- ${l.url} → анкор: "${l.anchor}"`)
    .join('\n');

  return `=== ВНЕШНИЕ ССЫЛКИ (ПЕРЕЛИНКОВКА) ===
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

function buildEeatBlock(): string {
  return `=== E-E-A-T И ЭКСПЕРТНОСТЬ ===
Если тема затрагивает регулируемую область (медицина, финансы, строительство, образование, право, безопасность, налоги, страхование), усиль экспертность текста:
- Ссылайся на конкретные законы, ГОСТы, СНиПы, СанПиНы, постановления правительства. Не "по закону", а "согласно ФЗ-152 «О персональных данных»".
- Указывай актуальные цифры: ставки, лимиты, сроки, штрафы из действующего законодательства.
- Если в теме есть профессиональные стандарты — упомяни их.
Это повышает доверие к статье и улучшает SEO-ранжирование.
Не выдумывай номера законов — используй только те, в которых уверен. Если точный номер неизвестен, сформулируй как "действующее законодательство РФ обязывает..." без конкретного номера.`;
}

function buildAntiDetectBlock(tone: string): string {
  const rules: string[] = [
    'Чередуй короткие (5-10 слов) и длинные (15-25 слов) предложения. Три предложения одинаковой длины подряд — запрещено.',
    'Абзацы: 2-6 предложений, разной длины. Длина H2-блоков различается минимум на 30%.',
    'Каждый абзац начинай с разной конструкции: факт, вопрос, пример, утверждение, число. Два одинаковых начала подряд — запрещено.',
  ];
  if (tone !== 'scientific' && tone !== 'business') {
    rules.push(
      '1-2 разговорные вставки на каждые 2000 символов (риторический вопрос, живой пример, обращение к читателю).',
    );
  }
  rules.push(
    'Каждый H2-блок содержит минимум 1 конкретику: число, дату, пример, название, кейс.',
    'Каждые 3000 символов — элемент, разбивающий стену текста (перечисление в тексте, факт в цифрах, мини-кейс).',
  );

  const numberedRules = rules.map((r, i) => `${i + 1}. ${r}`).join('\n');

  return `=== АНТИДЕТЕКТ (КРИТИЧНО — НЕСОБЛЮДЕНИЕ = БРАК) ===

Правила вариативности:
${numberedRules}

Запрещённые конструкции (нельзя использовать НИ В КАКОМ ВИДЕ):
«В настоящее время», «Стоит отметить», «Как известно», «На сегодняшний день», «Важно отметить», «Следует подчеркнуть», «Необходимо учитывать», «Таким образом», «В нашей статье мы расскажем», «Читайте далее», «Давайте разберёмся», «Не секрет, что», «В современном мире».

ПРИМЕРЫ:

Плохо (AI-стиль — однообразно, шаблонно):
"Платформа предоставляет широкий ассортимент товаров. Платформа обеспечивает проверку подлинности. Платформа гарантирует безопасность сделок. Важно отметить, что сервис работает круглосуточно."

Хорошо (живой текст — вариативные начала, конкретика, разная длина):
"Каталог насчитывает более 50 000 позиций от 300 брендов. Каждая посылка проходит 9 этапов проверки — от визуального осмотра швов до сверки штрих-кодов с базой производителя. А если товар не прошёл контроль? Покупатель получает полный возврат в течение 3 дней."`;
}

const READABILITY_BLOCK = `=== ЧИТАБЕЛЬНОСТЬ ===
- Максимум 35 слов в предложении.
- Максимум 6 предложений в абзаце.
- Не более 3 сложноподчинённых предложений подряд.`;

const FORMAT_EXAMPLE_BLOCK = `=== ПРИМЕР ФОРМАТА ===
Ниже — образец одного H2-блока. Это не шаблон для копирования. Это демонстрация структуры, длины абзацев, вариативности и стиля.

<h2>Как работает система аутентификации</h2>
<p>Каждый товар проходит 9 этапов проверки перед отправкой покупателю. Эксперты анализируют материалы, швы, маркировку и упаковку. В 2024 году платформа отклонила более 3% товаров на этапе проверки.</p>
<h3>Этапы проверки подлинности</h3>
<p>Первый этап — визуальный осмотр упаковки и сопроводительных документов. Специалисты сверяют штрих-коды с базой производителя. Далее товар переходит к экспертам по материалам, которые оценивают качество ткани, кожи или пластика.</p>
<p>Зачем столько проверок? За последний год 4 из 100 посылок содержали несоответствия — подмену размерной сетки, неоригинальную фурнитуру, повреждения при транспортировке. Многоуровневый контроль отсеивает такие случаи до отправки.</p>`;

export function buildSystemPrompt(
  input: Record<string, unknown>,
  brief: BriefData,
): string {
  const blocks: string[] = [];

  const charCount = (input.target_char_count as number) ?? 8000;
  const imageCount = (input.image_count as number) ?? 0;
  const faqCount = (input.faq_count as number) ?? 5;
  const intent = (input.intent as string) ?? 'informational';
  const tone = (input.tone_of_voice as string) ?? 'expert';
  const geo = (input.geo_location as string) ?? '';
  const brand = (input.brand as string) ?? '';
  const brandUrl = input.brand_url as string | undefined;
  const brandDescription = input.brand_description as string | undefined;
  const cta = (input.cta as string) ?? '';
  const ctaUrl = input.cta_url as string | undefined;
  const keywords = (input.keywords as string) ?? '';
  const forbiddenWords = (input.forbidden_words as string) ?? '';
  const legalRestrictions = (input.legal_restrictions as string) ?? '';
  const extLinks =
    (input.external_links as Array<{ url: string; anchor: string }>) ?? [];
  const audience = input.target_audience as
    | { gender: string; age: string[] }
    | undefined;
  const gender = audience?.gender ?? 'all';
  const ages = audience?.age ?? ['all'];

  const h2Count =
    brief.h2_list?.length || Math.round(charCount / 2000);

  blocks.push(ROLE_BLOCK);
  blocks.push(buildVolumeBlock(charCount));
  blocks.push(buildStructureBlock(brief));
  blocks.push(buildBudgetBlock(charCount, h2Count, faqCount));
  blocks.push(buildMainKeywordBlock(brief, imageCount));
  blocks.push(buildAdditionalKeysBlock(keywords, brief.keys_per_section));

  if (brief.lsi_keywords?.length) {
    blocks.push(buildLsiBlock(brief.lsi_keywords));
  }

  blocks.push(buildIntentBlock(intent));
  blocks.push(buildToneBlock(tone));

  const audienceBlock = buildAudienceBlock(gender, ages);
  if (audienceBlock) blocks.push(audienceBlock);

  blocks.push(buildGeoBlock(geo, brief.geo_mentions));
  blocks.push(buildFaqBlock(faqCount));

  if (imageCount > 0) {
    blocks.push(buildImagesBlock(imageCount));
  }

  if (brand) {
    blocks.push(
      buildBrandBlock(
        brand,
        charCount,
        brief.brand_mentions,
        brandDescription,
        brandUrl,
      ),
    );
  }

  if (cta) {
    blocks.push(buildCtaBlock(cta, intent, ctaUrl));
  }

  const allLinks: Array<{ url: string; anchor: string }> = [];
  if (brand && brandUrl) allLinks.push({ url: brandUrl, anchor: brand });
  allLinks.push(...extLinks);
  if (allLinks.length > 0) {
    blocks.push(buildExternalLinksBlock(allLinks));
  }

  if (forbiddenWords) {
    blocks.push(buildForbiddenWordsBlock(forbiddenWords));
  }

  if (legalRestrictions) {
    blocks.push(buildLegalBlock(legalRestrictions));
  }

  blocks.push(buildEeatBlock());
  blocks.push(buildAntiDetectBlock(tone));
  blocks.push(READABILITY_BLOCK);
  blocks.push(FORMAT_EXAMPLE_BLOCK);

  return blocks.join('\n\n');
}
