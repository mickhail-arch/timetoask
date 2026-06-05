// modules/seo/steps/step-1-2-brief.ts — формирование ТЗ (структура H1/H2/H3, LSI)
import { generateAndMeter } from '@/modules/llm/meter';
import { getStepModel } from '@/modules/seo/config';
import { calculatePrice } from '../pricing';
import type { PricingConfig } from '../pricing';
import type { StepResult, PipelineContext, BriefData } from '../types';
import { getStructureLimits, FAQ_RE, CONCLUSION_RE, type StructureLimits } from '../limits';

const INTENT_STRUCTURES: Record<string, string> = {
  informational: 'определение/вводная → разбор основных аспектов → примеры/кейсы → вывод. Первый H2 — ответ на запрос напрямую.',
  educational: 'вводная (зачем это нужно) → пошаговые этапы → советы/лайфхаки → типичные ошибки. Каждый H2 — отдельный шаг или этап.',
  commercial: 'проблема/боль читателя → решение → преимущества → сравнение с альтернативами. Первый H2 — проблема, последний перед FAQ — почему это решение лучше.',
  comparative: 'критерии выбора → сравнение вариантов по критериям → рекомендация. Первый H2 — на что обращать внимание, далее H2 по каждому варианту или критерию.',
  review: 'что это и для кого → ключевые характеристики → плюсы и минусы → вердикт. Структура от общего к частному.',
  news: 'контекст/предыстория → суть события → последствия/прогнозы. Первый H2 — что произошло.',
  problem_solution: 'описание проблемы → причины → конкретные решения с примерами. Каждый H2-решение — отдельный подход.',
};

function buildBriefPrompt(
  input: Record<string, unknown>,
  chars: number,
  limits: StructureLimits,
  maxKeywords: number,
  faqCount: number,
  comparisonEnabled: boolean,
  competitorMeta: Array<{ url: string; metaTitle?: string; headings?: string[]; contentSnippet?: string }>,
): string {
  const intent = (input.intent as string) ?? 'informational';
  const geo = (input.geo_location as string) ?? '';
  const brand = (input.brand as string) ?? '';
  const intentStructure = INTENT_STRUCTURES[intent] ?? INTENT_STRUCTURES.informational;
  const currentYear = new Date().getFullYear();

  const contextNotes = (input.context_notes as string) ?? '';

  let prompt = `Ты — SEO-архитектор. Создай структуру статьи на русском языке.
${contextNotes ? `\n!!! КРИТИЧЕСКИЕ ОГРАНИЧЕНИЯ ОТ АВТОРА (читай в первую очередь, имеют высший приоритет) !!!
"${contextNotes}"

Эти указания определяют смысловую рамку статьи. Соблюдай их во всех H2/H3/тезисах/фактах:
- Сегмент аудитории, указанный автором — это единственный сегмент, для которого пишется статья. Не упоминай другие сегменты, даже если они логически связаны.
- Темы, исключённые автором — не включай ни в H2, ни в подтемы, ни в LSI-ключи, ни в FAQ.
- Контекст или ракурс автора — отражай в каждом тезисе и факте.
Если стандартный интент-шаблон противоречит этим указаниям — приоритет у указаний автора.
` : ''}

Верни ТОЛЬКО валидный JSON (без markdown, без \`\`\`):
{
  "h1": "заголовок H1 (содержит основной ключ, до 60-70 символов)",
  "h2_list": [
    {
      "text": "заголовок H2",
      "h3s": ["заголовок H3"],
      "thesis": "о чём писать в разделе (1 предложение)",
      "facts": ["конкретный факт или цифра", "пример или кейс"],
      "target_keywords": ["какие ключи из списка раскрыть в этом разделе"]
    }
  ],
  "subtopics": ["подтема 1", "подтема 2"],
  "lsi_keywords": ["LSI-ключ 1", "LSI-ключ 2"],
  "featured_snippet_spec": "формат рекомендуемого Featured Snippet (параграф/список/таблица)",
  "main_keyword": "извлечённый основной ключ (2-5 слов)",
  "table_topic": "тема для таблицы сравнения (например: Сравнение X vs Y vs Z по 3 критериям)",
  "case_topic": "тема для блока личного опыта/кейса (например: Мой опыт использования X на проекте Y)"
}

=== ТЕКУЩИЙ ГОД ===
Сегодня: ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}. Текущий год: ${currentYear}.
КРИТИЧНО: если упоминаешь год в H1, H2, H3, подтемах, тезисах или фактах — используй ТОЛЬКО ${currentYear}.
Год ${currentYear - 1} или ${currentYear - 2} допустимы ТОЛЬКО при описании прошлых событий с явным контекстом ("итоги ${currentYear - 1} года", "сравнение с ${currentYear - 1}").
ЗАПРЕЩЕНО: ставить ${currentYear - 1}, ${currentYear - 2}, ${currentYear - 3} в заголовках или контексте актуальных данных. Если статья про "лучшие X" или "как сделать Y" или "топ Z" — всегда ${currentYear}.

=== СТРУКТУРА ===
- ВСЕГО H2 в статье: от ${limits.h2[0]} до ${limits.h2[1]} штук. В это число входят:
  • Контентные H2 (раскрывают аспекты темы) — минимум ${limits.contentH2Min}
  • Заключение (всегда отдельный последний H2 перед FAQ)${faqCount > 0 ? `\n  • H2 "Часто задаваемые вопросы" (FAQ-блок) — обязателен` : ''}${comparisonEnabled ? `\n  • H2 со сравнительной таблицей (отдельный раздел)` : ''}
- НЕ создавай отдельные H2 для: оглавления, времени чтения, блока автора, CTA, личного кейса — это служебные элементы, не разделы.
- Между двумя смежными H2 минимум ${limits.minCharsBetweenH2} символов содержательного текста.

H3-правила:
- На каждый контентный H2: от ${limits.h3PerH2[0]} до ${limits.h3PerH2[1]} H3.
- Общее количество H3 в основных и заключительном H2: максимум ${limits.maxH3Total}. H3 внутри FAQ-блока (вопросы) в этот лимит НЕ входят.
- H3 ставь только в H2, который будет содержать минимум ${limits.minH2CharsForH3} символов текста. В коротких H2 — H3 не нужны.
- Правило ноль или два: либо в H2 нет H3 совсем, либо минимум 2 H3. Один одинокий H3 в H2 не имеет смысла.
- H3 ставь только когда H2-раздел содержит несколько логически разделимых подразделов:
  • Пошаговый процесс из 3+ шагов → H3 на каждый шаг или группу шагов
  • Список из 3+ типов / категорий / вариантов → H3 на каждый
  • Многоаспектная тема (несколько критериев, факторов, параметров) → H3 по аспектам
- НЕ ставь H3 в H2, который раскрывает одну мысль, одно определение, одну рекомендацию.
- НЕ ставь H3 в заключении, во введении, в коротких ответах на конкретный вопрос.
- ЗАПРЕЩЕНО искусственно дробить H2 на H3 ради симметрии или «равномерного распределения» — это антипаттерн с точки зрения Google.
- Анализируй каждый H2 по тезису: если в thesis написано "расскажем о X, Y и Z" или "разберём 4 способа" — нужны H3 по этим элементам. Если "X — это Y" или "почему стоит выбрать Z" — H3 не нужны.
- Если из K контентных H2 только 1-2 имеют многоаспектное содержание — пусть H3 будут только в этих 1-2, остальные без H3. Несимметричная структура — это нормально и правильно с точки зрения E-E-A-T и Google Search Quality Guidelines.
- Целевое использование maxH3Total: 70-100%. Если maxH3Total=4 — оптимально 3-4 H3 (минимум 3). Меньше 70% — структура недоиспользована, статья выглядит плоской для SEO.
- При этом ставь H3 только в содержательно оправданные места (см. правила выше). Если из K контентных H2 содержательно подходят только 1-2 — это нормально, оставь так.
- Но если есть 3+ многоаспектных H2 — задействуй их все, пока не достигнешь 70-100% maxH3Total.
- Запрещено искусственно дробить H2 ради заполнения лимита — лучше 70% по делу, чем 100% «для галочки».

Общие правила:
- H2 и H3 не совпадают по содержанию более чем на 60%.
- Каждый контентный H2 раскрывает отдельный аспект темы, без пересечений.
- После прочтения всех H2 читатель должен получить исчерпывающий ответ на запрос.
- H4, H5, H6 запрещены полностью. Используй только H1, H2, H3.

=== INTENT: ${intent.toUpperCase()} ===
Логика структуры: ${intentStructure}
Подбирай H2-заголовки так, чтобы они следовали этой логике изложения.

=== ОСНОВНОЙ КЛЮЧ ===
- Если запрос ≤5 слов — целиком. Если >5 — извлеки ВЧ-ядро 2-5 слов.
- H1 обязательно содержит основной ключ.
- Один H2 содержит основной ключ (в разбавленной форме).

=== ДОПОЛНИТЕЛЬНЫЕ КЛЮЧИ ===
- Макс ключей: ${maxKeywords}
- В поле target_keywords для каждого H2 укажи 1-${Math.min(3, Math.ceil(maxKeywords / limits.h2[0]))} ключа из списка пользователя, которые логически относятся к этому разделу.
- Каждый ключ должен быть назначен ровно одному H2. Не дублируй ключи между разделами.
- 30-50% контентных H2 содержат доп.ключ прямо в заголовке.

=== LSI ===
- 2-4 уникальных LSI на каждые 2000 символов (итого ${Math.max(2, Math.floor(chars / 2000) * 2)}-${Math.floor(chars / 2000) * 4}).
- Не дублируй keywords. LSI — это синонимы, связанные понятия, профессиональные термины по теме.

=== ТЕЗИСЫ И ФАКТЫ ===
- thesis: одно предложение — что именно раскрывать в разделе, какой вопрос читателя он закрывает.
- facts: 1-2 конкретных факта, цифры, примера или кейса. Должны быть реалистичными и проверяемыми. Не выдумывай — если точная цифра неизвестна, предложи формулировку "по данным исследований..." или "в среднем по рынку...".`;

  if (geo) {
    prompt += `\n\n=== ГЕО ===\nРегион: ${geo}. Учитывай региональную специфику в тезисах и фактах где уместно.`;
  }

  if (brand) {
    prompt += `\n\n=== БРЕНД ===\nБренд "${brand}" — не включай в H1 (если не часть ключа). Допустим в 1 H2-заголовке. Учти в тезисах: один H2 может содержать упоминание бренда в контексте.`;
  }

  if (comparisonEnabled) {
    prompt += `\n\n=== СРАВНИТЕЛЬНАЯ ТАБЛИЦА ===\nОдин из основных H2 должен быть посвящён сравнению вариантов/продуктов/методов по теме. Именно в этом H2 будет встроена таблица сравнения. Сформулируй H2 так, чтобы заголовок отражал тему сравнения (например: "Сравнение X, Y и Z по ключевым параметрам"). В thesis этого H2 укажи, что раздел содержит таблицу. В table_topic пиши развёрнутую тему таблицы.`;
  }

  if (faqCount > 0) {
    prompt += `\n\n=== FAQ ===\nПоследний H2 = "Часто задаваемые вопросы" с ${faqCount} H3 (каждый H3 = конкретный вопрос, 5-10 слов).
Вопросы должны быть реальными — то, что люди спрашивают по теме. 1-2 вопроса содержат основной ключ.
Не дублируй содержание основных H2. FAQ закрывает вопросы, не раскрытые в основном тексте.`;
  } else {
    prompt += `\n\n=== FAQ ===\nFAQ-блок не нужен. Не добавляй H2 с вопросами.`;
  }

  prompt += `\n\n=== FEATURED SNIPPET ===
Определи, какой формат Featured Snippet подойдёт для этого запроса:
- "paragraph" — если запрос "что такое X", "как работает X"
- "list" — если запрос "как сделать X", "этапы X", "лучшие X"
- "table" — если запрос сравнительный или содержит "vs", "сравнение"
Укажи в featured_snippet_spec.`;

  prompt += `\n\n=== E-E-A-T БЛОКИ ===
Дополнительно сгенерируй:
- table_topic: тема для таблицы сравнения. Таблица должна отвечать на конкретный вопрос — сравнение продуктов, методов или характеристик по теме статьи. Минимум 3 столбца, 4 строки.
- case_topic: тема для блока личного опыта. Это кейс от первого лица: конкретная ситуация, действие, результат с цифрами. Не повторяет основной текст, а дополняет его практическим примером.`;

  if (competitorMeta.length > 0) {
    const topCompetitors = competitorMeta.slice(0, 5);
    prompt += `\n\n=== АНАЛИЗ КОНКУРЕНТОВ ИЗ ТОПА ВЫДАЧИ ===
Ниже — реальная структура и фрагменты текста статей, которые уже ранжируются в топ-10 по этому запросу. Используй их как ОРИЕНТИР, не копируй.

Что брать из конкурентов:
- ПОДТЕМЫ: какие аспекты темы покрывают топ-статьи (отрази их в своих H2).
- LSI и тематическую лексику: профессиональные термины, синонимы, сопутствующие понятия.
- УРОВЕНЬ ДЕТАЛИЗАЦИИ: насколько глубоко они разбирают каждый аспект.
- ФАКТЫ И ЦИФРЫ: реальные данные, которые можно использовать в thesis/facts (с указанием источника).

Что НЕ копировать:
- Дословные формулировки H1/H2.
- Структуру 1-в-1 — твоя статья должна закрывать тему ПОЛНЕЕ конкурентов.

Конкуренты (топ ${topCompetitors.length}):
${topCompetitors.map((c, i) => {
  const headingsList = (c.headings ?? []).slice(0, 12).map(h => `   - ${h}`).join('\n');
  const snippet = c.contentSnippet ? c.contentSnippet.slice(0, 800).replace(/\s+/g, ' ').trim() : '';
  return `[${i + 1}] ${c.metaTitle ?? 'Без title'}
URL: ${c.url}
Заголовки:
${headingsList || '   (не извлечены)'}
Фрагмент: ${snippet || '(пусто)'}
---`;
}).join('\n')}

Задача:
1. Из заголовков конкурентов извлеки 5-10 ключевых подтем — раскрой их в своих H2 (своими формулировками).
2. Из фрагментов текста собери LSI-лексику — добавь в lsi_keywords семантически близкие термины которые встречаются у конкурентов.
3. Если у конкурентов есть факты/цифры — включи похожие по типу в facts соответствующих H2 (с формулировкой "по данным исследований..." или с конкретным источником).
4. ВАЖНО: твоя структура должна быть ПОЛНЕЕ топа выдачи — добавь 1-2 аспекта темы, которые конкуренты пропустили.`;
  }

  return prompt;
}

function parseBriefResponse(
  raw: string,
  ctx: PipelineContext,
  chars: number,
  maxKeywords: number,
  mainKeywordMin: number,
  mainKeywordMax: number,
  limits: StructureLimits,
): BriefData {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);

  type H2Item = { text: string; h3s: string[]; thesis: string; facts: string[]; target_keywords: string[] };
  let h2List: H2Item[] = Array.isArray(parsed.h2_list) ? parsed.h2_list.map((h2: Record<string, unknown>) => ({
    text: (h2.text as string) ?? '',
    h3s: Array.isArray(h2.h3s) ? h2.h3s as string[] : [],
    thesis: (h2.thesis as string) ?? '',
    facts: Array.isArray(h2.facts) ? h2.facts as string[] : [],
    target_keywords: Array.isArray(h2.target_keywords) ? h2.target_keywords as string[] : [],
  })) : [];

  // 1. Удалить запрещённые служебные H2 (оглавление, время чтения, CTA, кейс)
  const FORBIDDEN_H2 = /^(оглавление|содержание|время прочтения|время чтения|автор|cta|призыв|кейс|личный опыт)$/i;
  h2List = h2List.filter(h2 => !FORBIDDEN_H2.test(h2.text.trim()));

  // 2. Обрезка H2 до limits.h2[1] (сохраняем FAQ/заключение)
  if (h2List.length > limits.h2[1]) {
    const faqIdx = h2List.findIndex(h2 => FAQ_RE.test(h2.text));
    const conclIdx = h2List.findIndex((h2, i) => i >= h2List.length - 3 && CONCLUSION_RE.test(h2.text));
    const protectedIdxs = new Set<number>();
    if (faqIdx >= 0) protectedIdxs.add(faqIdx);
    if (conclIdx >= 0) protectedIdxs.add(conclIdx);

    const result: typeof h2List = [];
    for (let i = 0; i < h2List.length && result.length < limits.h2[1] - protectedIdxs.size; i++) {
      if (!protectedIdxs.has(i)) result.push(h2List[i]);
    }
    if (conclIdx >= 0) result.push(h2List[conclIdx]);
    if (faqIdx >= 0) result.push(h2List[faqIdx]);
    h2List = result.slice(0, limits.h2[1]);
  }

  // 3. Обрезка H3 с учётом распределения и лимита на H2
  let totalH3 = 0;
  h2List = h2List.map(h2 => {
    if (FAQ_RE.test(h2.text)) return h2; // FAQ H3 не урезаем
    if (CONCLUSION_RE.test(h2.text)) return { ...h2, h3s: [] }; // заключение без H3

    let h3s = h2.h3s.slice(0, limits.h3PerH2[1]);
    const allowed = Math.max(0, limits.maxH3Total - totalH3);
    h3s = h3s.slice(0, allowed);

    // Правило ноль-или-два: если получился 1 H3 — убираем (одиночный H3 не имеет смысла)
    if (h3s.length === 1 && limits.h3PerH2[0] === 0) {
      h3s = [];
    }

    totalH3 += h3s.length;
    return { ...h2, h3s };
  });

  return {
    h1: parsed.h1 ?? '',
    h2_list: h2List,
    subtopics: Array.isArray(parsed.subtopics) ? parsed.subtopics : [],
    lsi_keywords: Array.isArray(parsed.lsi_keywords) ? parsed.lsi_keywords : [],
    featured_snippet_spec: parsed.featured_snippet_spec,
    main_keyword: parsed.main_keyword ?? String(ctx.input.target_query),
    main_keyword_min: mainKeywordMin,
    main_keyword_max: mainKeywordMax,
    keys_per_section: Math.ceil(maxKeywords / Math.max(1, h2List.length || 3)),
    cta_position: ctx.input.cta ? 'after_conclusion' : undefined,
    brand_mentions: ctx.input.brand
      ? (ctx.input.intent === 'commercial' ? 3 : 2)
      : 0,
    geo_mentions: ctx.input.geo_location
      ? (String(ctx.input.geo_location).includes(',') ? 4 : 3)
      : 0,
    table_topic: parsed.table_topic ?? '',
    table_after_h2: Math.min(1, h2List.length - 1),
    case_topic: parsed.case_topic ?? '',
    callout_count: chars <= 6000 ? 2 : chars <= 10000 ? 3 : chars <= 14000 ? 4 : 5,
    citation_count: chars <= 10000 ? 1 : 2,
    faq_count_eeat: Math.min(10, Math.max(2, Math.floor(chars / 2000))),
    toc_enabled: false,
    intro_chars: Math.round(chars * 0.04),
    tldr_chars: Math.round(chars * 0.02),
    table_chars: Math.round(chars * 0.04),
    case_chars: Math.round(chars * 0.05),
    conclusion_chars: Math.round(chars * 0.05),
    faq_chars: Math.round(chars * 0.10),
  };
}

export async function executeBrief(ctx: PipelineContext): Promise<StepResult> {
  const start = Date.now();

  const model = getStepModel(
    ctx.config as import('@/core/types').ToolConfig | null,
    'brief',
    'anthropic/claude-opus-4.6',
  );

  const chars = (ctx.input.target_char_count as number) ?? 8000;
  const imageCount = (ctx.input.image_count as number) ?? 0;
  const intent = (ctx.input.intent as string) ?? 'informational';
  const limits = getStructureLimits(chars, intent);
  const inputFaqCount = (ctx.input.faq_count as number) ?? 0;
  const faqCount = inputFaqCount > 0 ? Math.min(inputFaqCount, limits.maxFaq) : 0;
  const maxKeywords = Math.floor(chars / 800);

  // Расчёт плотности основного ключа
  const mainKeywordMin = Math.max(2, Math.floor(chars / 2500));
  const mainKeywordMax = Math.floor(chars / 1000);

  const comparisonEnabled = (ctx.input.comparison_enabled as boolean) ?? false;
  const competitorMeta = (ctx.data.competitorMeta as Array<{
    url: string;
    metaTitle?: string;
    headings?: string[];
    contentSnippet?: string;
  }> | undefined) ?? [];
  const systemPrompt = buildBriefPrompt(ctx.input, chars, limits, maxKeywords, faqCount, comparisonEnabled, competitorMeta);

  const contextNotes = (ctx.input.context_notes as string) ?? '';

  const userMessage = `Тема: ${ctx.input.target_query}
Ключевые слова: ${ctx.input.keywords}
Intent: ${ctx.input.intent}
Объём: ${chars} символов
Изображений: ${imageCount}
FAQ: ${faqCount}
Tone: ${ctx.input.tone_of_voice ?? 'expert'}
Гео: ${ctx.input.geo_location ?? 'вся Россия'}
Автор: ${ctx.input.author_name ?? 'не указан'}
Компания: ${ctx.input.author_company ?? 'не указана'}${contextNotes ? `\n\nКРИТИЧЕСКИ ВАЖНЫЕ ОГРАНИЧЕНИЯ ОТ АВТОРА (приоритет выше всех остальных правил): ${contextNotes}\n\nЭто смысловые указания о том, что важно учесть в брифе:\n- Если автор указал сегмент (B2C / B2B / новички / профи) — формируй H2 только под этот сегмент, не уходи в другие.\n- Если автор просит не затрагивать какие-то темы — не включай их ни в H2, ни в подтемы, ни в FAQ-вопросы.\n- Если задан контекст (регион / возрастная группа / конкретный случай) — учитывай его в тезисах и фактах каждого H2.\nЭти указания важнее общих рекомендаций по интенту и структуре. При конфликте — следуй им.` : ''}`;

  try {
    const raw = await generateAndMeter({ model, systemPrompt, userMessage }, { userId: ctx.userId, feature: 'seo-article', sessionId: ctx.sessionId });
    const brief = parseBriefResponse(raw, ctx, chars, maxKeywords, mainKeywordMin, mainKeywordMax, limits);
    
    // Рассчитать цену
    const pricingConfig = (ctx.config as Record<string, unknown>)?.pricing as
      | Partial<PricingConfig>
      | undefined;
    const price = calculatePrice(chars, imageCount, faqCount, pricingConfig, ctx.input.ai_model as string, (ctx.input.analysis_model as string) ?? 'sonnet');

    return {
      success: true,
      data: { ...brief, calculatedPrice: price.total, priceBreakdown: price },
      durationMs: Date.now() - start,
      requiresConfirmation: true,
    };
  } catch (err) {
    // Retry 1 раз
    try {
      const raw = await generateAndMeter({ model, systemPrompt, userMessage }, { userId: ctx.userId, feature: 'seo-article', sessionId: ctx.sessionId });
      const brief = parseBriefResponse(raw, ctx, chars, maxKeywords, mainKeywordMin, mainKeywordMax, limits);

      const pricingConfig = (ctx.config as Record<string, unknown>)?.pricing as
        | Partial<PricingConfig> | undefined;
      const price = calculatePrice(chars, imageCount, faqCount, pricingConfig, ctx.input.ai_model as string, (ctx.input.analysis_model as string) ?? 'sonnet');

      return {
        success: true,
        data: { ...brief, calculatedPrice: price.total, priceBreakdown: price },
        durationMs: Date.now() - start,
        requiresConfirmation: true,
      };
    } catch (retryErr) {
      return {
        success: false,
        data: {},
        error: `Не удалось сформировать ТЗ: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
        durationMs: Date.now() - start,
      };
    }
  }
}
