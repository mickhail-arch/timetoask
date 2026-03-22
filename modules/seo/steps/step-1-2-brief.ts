// modules/seo/steps/step-1-2-brief.ts — формирование ТЗ (структура H1/H2/H3, LSI)
import { generateText } from '@/adapters/llm/openrouter.adapter';
import { getStepModel } from '@/modules/seo/config';
import { calculatePrice } from '../pricing';
import type { PricingConfig } from '../pricing';
import type { StepResult, PipelineContext, BriefData } from '../types';

// SEO-таблица: символы → диапазоны H2/H3
const SEO_TABLE: Record<number, { h2: [number, number]; h3: [number, number] }> = {
  4000:  { h2: [1, 2], h3: [1, 2] },
  6000:  { h2: [2, 3], h3: [2, 3] },
  8000:  { h2: [3, 4], h3: [3, 4] },
  10000: { h2: [4, 5], h3: [4, 5] },
  12000: { h2: [5, 6], h3: [5, 7] },
  14000: { h2: [6, 7], h3: [6, 8] },
  16000: { h2: [7, 8], h3: [7, 9] },
  18000: { h2: [8, 9], h3: [8, 10] },
  20000: { h2: [9, 10], h3: [9, 11] },
};

function getSeoLimits(chars: number) {
  const keys = Object.keys(SEO_TABLE).map(Number).sort((a, b) => a - b);
  let best = keys[0];
  for (const k of keys) {
    if (chars >= k) best = k;
  }
  return SEO_TABLE[best];
}

export async function executeBrief(ctx: PipelineContext): Promise<StepResult> {
  const start = Date.now();

  const model = getStepModel(
    ctx.config as import('@/core/types').ToolConfig | null,
    'brief',
    'google/gemini-2.5-flash',
  );

  const chars = (ctx.input.target_char_count as number) ?? 8000;
  const imageCount = (ctx.input.image_count as number) ?? 0;
  const faqCount = (ctx.input.faq_count as number) ?? 5;
  const limits = getSeoLimits(chars);
  const maxKeywords = Math.floor(chars / 800);

  // Расчёт плотности основного ключа
  const mainKeywordMin = Math.max(2, Math.floor(chars / 2500));
  const mainKeywordMax = Math.floor(chars / 1000);

  const systemPrompt = `Ты — SEO-архитектор. Создай структуру статьи на русском языке.

Верни ТОЛЬКО валидный JSON (без markdown, без \`\`\`):
{
  "h1": "заголовок H1 (содержит основной ключ, до 60-70 символов)",
  "h2_list": [
    {
      "text": "заголовок H2",
      "h3s": ["заголовок H3", "заголовок H3"],
      "thesis": "краткий тезис: о чём писать в этом разделе (1 предложение)",
      "facts": ["конкретный факт или цифра для раздела", "пример или кейс"]
    }
  ],
  "subtopics": ["подтема 1", "подтема 2"],
  "lsi_keywords": ["LSI-ключ 1", "LSI-ключ 2"],
  "featured_snippet_spec": "формат рекомендуемого Featured Snippet",
  "main_keyword": "извлечённый основной ключ (2-5 слов)"
}

Правила:
- H2: от ${limits.h2[0]} до ${limits.h2[1]} штук (1 на каждые 1500-2000 символов)
- H3: от ${limits.h3[0]} до ${limits.h3[1]} штук (только внутри H2)
- H2 и H3 не совпадают более чем на 60%
- Основной ключ: если запрос ≤5 слов — целиком, если >5 — ВЧ-ядро 2-5 слов
- H1 содержит основной ключ
- LSI: 2-4 уникальных на каждые 2000 символов, не дублировать keywords
- thesis: для каждого H2 — одно предложение, объясняющее что именно раскрывать в разделе
- facts: 1-2 конкретных факта, цифры, примера или кейса которые должны быть упомянуты в разделе. Не выдумывай — предлагай реалистичные данные по теме
- Макс доп. ключей: ${maxKeywords}
- Если faq_count > 0: последний H2 = "Часто задаваемые вопросы" с H3 для каждого вопроса`;

  const userMessage = `Тема: ${ctx.input.target_query}
Ключевые слова: ${ctx.input.keywords}
Intent: ${ctx.input.intent}
Объём: ${chars} символов
Изображений: ${imageCount}
FAQ: ${faqCount}
Tone: ${ctx.input.tone_of_voice ?? 'expert'}
Гео: ${ctx.input.geo_location ?? 'вся Россия'}`;

  try {
    const raw = await generateText({ model, systemPrompt, userMessage });
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const brief: BriefData = {
      h1: parsed.h1 ?? '',
      h2_list: Array.isArray(parsed.h2_list) ? parsed.h2_list.map((h2: Record<string, unknown>) => ({
        text: (h2.text as string) ?? '',
        h3s: Array.isArray(h2.h3s) ? h2.h3s as string[] : [],
        thesis: (h2.thesis as string) ?? '',
        facts: Array.isArray(h2.facts) ? h2.facts as string[] : [],
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
    };

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
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const brief: BriefData = {
        h1: parsed.h1 ?? '',
        h2_list: Array.isArray(parsed.h2_list) ? parsed.h2_list.map((h2: Record<string, unknown>) => ({
          text: (h2.text as string) ?? '',
          h3s: Array.isArray(h2.h3s) ? h2.h3s as string[] : [],
          thesis: (h2.thesis as string) ?? '',
          facts: Array.isArray(h2.facts) ? h2.facts as string[] : [],
        })) : [],
        subtopics: Array.isArray(parsed.subtopics) ? parsed.subtopics : [],
        lsi_keywords: Array.isArray(parsed.lsi_keywords) ? parsed.lsi_keywords : [],
        featured_snippet_spec: parsed.featured_snippet_spec,
        main_keyword: parsed.main_keyword ?? String(ctx.input.target_query),
        main_keyword_min: Math.max(2, Math.floor(chars / 2500)),
        main_keyword_max: Math.floor(chars / 1000),
        keys_per_section: Math.ceil(maxKeywords / Math.max(1, (parsed.h2_list?.length ?? 3))),
        cta_position: ctx.input.cta ? 'after_conclusion' : undefined,
        brand_mentions: ctx.input.brand ? (ctx.input.intent === 'commercial' ? 3 : 2) : 0,
        geo_mentions: ctx.input.geo_location ? 3 : 0,
      };

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
