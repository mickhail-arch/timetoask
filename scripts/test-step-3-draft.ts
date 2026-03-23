// scripts/test-step-3-draft.ts — тест генерации черновика (Step 3)
// Запуск: npx tsx scripts/test-step-3-draft.ts

import { config } from 'dotenv';
config();

async function main() {
  console.log('=== TEST: Step 3 — Draft ===\n');

  const { executeDraft } = await import('@/modules/seo/steps/step-3-draft');

  const brief = {
    h1: 'Poizon что это: полный обзор платформы',
    h2_list: [
      {
        text: 'Как работает Poizon',
        h3s: ['Регистрация и первые шаги', 'Поиск и заказ товаров'],
      },
      {
        text: 'Преимущества и недостатки Poizon',
        h3s: ['Гарантия оригинальности'],
      },
    ],
    subtopics: ['доставка из Китая', 'верификация товаров'],
    lsi_keywords: ['оригинальные кроссовки', 'маркетплейс Китай', 'проверка подлинности'],
    featured_snippet_spec: 'определение + список шагов',
    main_keyword: 'poizon что это',
    main_keyword_min: 2,
    main_keyword_max: 5,
    keys_per_section: 2,
    brand_mentions: 0,
    geo_mentions: 0,
  };

  const ctx: import('@/modules/seo/types').PipelineContext = {
    jobId: 'test-draft-001',
    userId: 'test-user',
    input: {
      target_query: 'poizon что это',
      keywords: 'poizon\nпойзон приложение',
      intent: 'informational',
      target_char_count: 5000,
      image_count: 2,
      faq_count: 3,
      tone_of_voice: 'expert',
      brand: 'CoffeeShop.ru',
      brand_url: 'https://coffeeshop.ru',
      brand_description: 'Интернет-магазин кофемашин с доставкой по России',
      cta: 'Подберите кофемашину в каталоге',
      cta_url: 'https://coffeeshop.ru/catalog',
      external_links: [
        { url: 'https://example.com/research', anchor: 'исследование рынка кофемашин' },
      ],
    },
    config: {
      models: { draft: 'anthropic/claude-sonnet-4' },
    },
    data: {
      confirmation: { brief, user_edited: false },
    },
  };

  console.log('Model: anthropic/claude-sonnet-4');
  console.log('Target chars:', ctx.input.target_char_count);
  console.log('Image count:', ctx.input.image_count);
  console.log('');

  try {
    const result = await executeDraft(ctx);

    if (!result.success) {
      console.error('FAIL: executeDraft returned success=false');
      console.error('Error:', result.error);
      console.log('\n=== RESULT: FAIL ===');
      process.exit(1);
    }

    const data = result.data;
    const html = data.article_html as string;

    console.log('article_html length:', html.length);
    console.log('char_count (text only):', data.char_count);
    console.log('H1 count:', data.h1_count);
    console.log('H2 count:', data.h2_count);
    console.log('image_markers:', data.image_markers);

    const marker1 = html.includes('[IMAGE_1]');
    const marker2 = html.includes('[IMAGE_2]');
    console.log(`\n[IMAGE_1] found: ${marker1 ? 'OK' : 'FAIL'}`);
    console.log(`[IMAGE_2] found: ${marker2 ? 'OK' : 'FAIL'}`);
    console.log(`Image markers found: ${(data.image_markers as number) ?? 0}`);

    const hasAnchorTag = /<a\s+href/i.test(html);
    console.log(`\n<a href> (brand link) found: ${hasAnchorTag ? 'OK' : 'FAIL'}`);

    const warnings = data.warnings as string[];
    if (warnings?.length) {
      console.log('\nWarnings:');
      for (const w of warnings) console.log('  WARN:', w);
    }

    console.log('\nDuration:', result.durationMs, 'ms');

    const hasMarkers = marker1 && marker2;
    if (!hasMarkers) {
      console.log('\nWARN: Not all image markers found in article');
      console.log('\n=== RESULT: WARN ===');
    } else {
      console.log('\nOK: Draft generated successfully');
      console.log('\n=== RESULT: OK ===');
    }
  } catch (err) {
    console.error('\nFAIL:', err instanceof Error ? err.message : err);
    if (err instanceof Error) console.error('Stack:', err.stack);
    console.log('\n=== RESULT: FAIL ===');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  console.log('\n=== RESULT: FAIL ===');
  process.exit(1);
});
