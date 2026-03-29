// modules/seo/steps/step-1-2-brief.ts — формирование ТЗ (структура H1/H2/H3, LSI)
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { getStepModel } from '@/modules/seo/config';
import { calculatePrice } from '../pricing';
import type { PricingConfig } from '../pricing';
import type { StepResult, PipelineContext, BriefData } from '../types';

// SEO-таблица: символы → диапазоны H2/H3, FAQ, заключение
const SEO_TABLE: Record<number, { h2: [number, number]; h3: [number, number]; maxH3Total: number; faqCount: [number, number]; hasConclusion: boolean }> = {
  6000:  { h2: [3, 3], h3: [0, 0], maxH3Total: 0, faqCount: [2, 2], hasConclusion: true },
  8000:  { h2: [3, 4], h3: [0, 2], maxH3Total: 4, faqCount: [2, 3], hasConclusion: true },
  10000: { h2: [4, 5], h3: [0, 2], maxH3Total: 6, faqCount: [3, 4], hasConclusion: true },
  12000: { h2: [5, 6], h3: [0, 2], maxH3Total: 8, faqCount: [4, 5], hasConclusion: true },
  14000: { h2: [6, 7], h3: [1, 3], maxH3Total: 12, faqCount: [5, 6], hasConclusion: true },
  16000: { h2: [7, 8], h3: [1, 3], maxH3Total: 14, faqCount: [6, 7], hasConclusion: true },
  18000: { h2: [8, 9], h3: [1, 3], maxH3Total: 16, faqCount: [7, 8], hasConclusion: true },
  20000: { h2: [9, 10], h3: [2, 3], maxH3Total: 18, faqCount: [8, 10], hasConclusion: true },
};

function getSeoLimits(chars: number): { h2: [number, number]; h3: [number, number]; maxH3Total: number; faqCount: [number, number]; hasConclusion: boolean } {
  const keys = Object.keys(SEO_TABLE).map(Number).sort((a, b) => a - b);
  let best = keys[0];
  for (const k of keys) {
    if (chars >= k) best = k;
  }
  return SEO_TABLE[best];
}

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
  limits: { h2: [number, number]; h3: [number, number]; maxH3Total: number; faqCount: [number, number]; hasConclusion: boolean },
  maxKeywords: number,
): string {
  const intent = (input.intent as string) ?? 'informational';
  const geo = (input.geo_location as string) ?? '';
  const brand = (input.brand as string) ?? '';
  const intentStructure = INTENT_STRUCTURES[intent] ?? INTENT_STRUCTURES.informational;

  let prompt = `Ты — SEO-архитектор. Создай структуру статьи на русском языке.

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
  "table_topic": "тема для таблицы сравнения (например: Сравнение X vs Y vs Z по 4 критериям)",
  "case_topic": "тема для блока личного опыта/кейса (например: Мой опыт использования X на проекте Y)"
}

=== СТРУКТУРА ===
- H2: от ${limits.h2[0]} до ${limits.h2[1]} штук (1 на каждые 1500-2000 символов)
- H3: от ${limits.h3[0]} до ${limits.h3[1]} штук на каждый H2 (только внутри H2).
- Общее количество H3 во всей статье: максимум ${limits.maxH3Total}. Если maxH3Total равен 0 — НЕ создавай H3 вообще, используй только H2. H3 на каждый H2: от ${limits.h3[0]} до ${limits.h3[1]}.
- FAQ вопросов: от ${limits.faqCount[0]} до ${limits.faqCount[1]}.${!limits.hasConclusion ? ' Заключение НЕ выделяй в отдельный H2 — просто заверши статью итоговым абзацем.' : ''}
${limits.faqCount[0] === 0 && limits.faqCount[1] === 0 ? '- FAQ-раздел не добавляй в h2_list.\n' : ''}${!limits.hasConclusion ? '- Заключение не добавляй как отдельный H2 в h2_list.\n' : ''}- H2 и H3 не совпадают более чем на 60%
- H2-заголовки должны полностью покрывать тему. Читатель после прочтения всех H2 должен получить исчерпывающий ответ на запрос.
- Каждый H2 раскрывает отдельный аспект темы, без пересечений.
- H4 запрещён. Используй только H1, H2, H3.

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
- 30-50% H2 содержат доп.ключ прямо в заголовке.

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

  if (limits.faqCount[0] > 0 || limits.faqCount[1] > 0) {
    prompt += `\n\n=== FAQ ===\nПоследний H2 = "Часто задаваемые вопросы" с ${limits.faqCount[0]}-${limits.faqCount[1]} H3 (каждый H3 = конкретный вопрос, 5-10 слов).
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

  return prompt;
}

function parseBriefResponse(
  raw: string,
  ctx: PipelineContext,
  chars: number,
  maxKeywords: number,
  mainKeywordMin: number,
  mainKeywordMax: number,
): BriefData {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    h1: parsed.h1 ?? '',
    h2_list: Array.isArray(parsed.h2_list) ? parsed.h2_list.map((h2: Record<string, unknown>) => ({
      text: (h2.text as string) ?? '',
      h3s: Array.isArray(h2.h3s) ? h2.h3s as string[] : [],
      thesis: (h2.thesis as string) ?? '',
      facts: Array.isArray(h2.facts) ? h2.facts as string[] : [],
      target_keywords: Array.isArray(h2.target_keywords) ? h2.target_keywords as string[] : [],
    })) : [],
    subtopics: Array.isArray(parsed.subtopics) ? parsed.subtopics : [],
    lsi_keywords: Array.isArray(parsed.lsi_keywords) ? parsed.lsi_keywords : [],
    featured_snippet_spec: parsed.featured_snippet_spec,
    main_keyword: parsed.main_keyword ?? String(ctx.input.target_query),
    main_keyword_min: mainKeywordMin,
    main_keyword_max: mainKeywordMax,
    keys_per_section: Math.ceil(maxKeywords / Math.max(1, (parsed.h2_list?.length ?? 3))),
    cta_position: ctx.input.cta ? 'after_conclusion' : undefined,
    brand_mentions: ctx.input.brand
      ? (ctx.input.intent === 'commercial' ? 3 : 2)
      : 0,
    geo_mentions: ctx.input.geo_location
      ? (String(ctx.input.geo_location).includes(',') ? 4 : 3)
      : 0,
    // E-E-A-T блоки (вычисляются по формулам из документа)
    table_topic: parsed.table_topic ?? '',
    table_after_h2: Math.min(1, (parsed.h2_list?.length ?? 2) - 1),
    case_topic: parsed.case_topic ?? '',
    callout_count: chars <= 6000 ? 2 : chars <= 10000 ? 3 : chars <= 14000 ? 4 : 5,
    citation_count: chars <= 10000 ? 1 : 2,
    faq_count_eeat: Math.min(10, Math.max(2, Math.floor(chars / 2000))),
    toc_enabled: chars >= 8000,
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
  const limits = getSeoLimits(chars);
  const faqCount = limits.faqCount[1];
  const maxKeywords = Math.floor(chars / 800);

  // Расчёт плотности основного ключа
  const mainKeywordMin = Math.max(2, Math.floor(chars / 2500));
  const mainKeywordMax = Math.floor(chars / 1000);

  const systemPrompt = buildBriefPrompt(ctx.input, chars, limits, maxKeywords);

  const userMessage = `Тема: ${ctx.input.target_query}
Ключевые слова: ${ctx.input.keywords}
Intent: ${ctx.input.intent}
Объём: ${chars} символов
Изображений: ${imageCount}
FAQ: ${faqCount}
Tone: ${ctx.input.tone_of_voice ?? 'expert'}
Гео: ${ctx.input.geo_location ?? 'вся Россия'}
Автор: ${ctx.input.author_name ?? 'не указан'}
Компания: ${ctx.input.author_company ?? 'не указана'}`;

  try {
    const raw = await generateText({ model, systemPrompt, userMessage });
    const brief = parseBriefResponse(raw, ctx, chars, maxKeywords, mainKeywordMin, mainKeywordMax);

    // Рассчитать цену
    const pricingConfig = (ctx.config as Record<string, unknown>)?.pricing as
      | Partial<PricingConfig>
      | undefined;
    const price = calculatePrice(chars, imageCount, faqCount, pricingConfig);

    return {
      success: true,
      data: { ...brief, calculatedPrice: price.total, priceBreakdown: price },
      durationMs: Date.now() - start,
      requiresConfirmation: true,
    };
  } catch (err) {
    // Retry 1 раз
    try {
      const raw = await generateText({ model, systemPrompt, userMessage });
      const brief = parseBriefResponse(raw, ctx, chars, maxKeywords, mainKeywordMin, mainKeywordMax);

      const pricingConfig = (ctx.config as Record<string, unknown>)?.pricing as
        | Partial<PricingConfig> | undefined;
      const price = calculatePrice(chars, imageCount, faqCount, pricingConfig);

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
