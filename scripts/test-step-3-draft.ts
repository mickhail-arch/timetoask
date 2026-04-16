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
      comparison_enabled: true,
      comparison_objects: 4,
      comparison_criteria: 5,
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
      models: { draft: 'anthropic/claude-opus-4.6' },
    },
    data: {
      confirmation: { brief, user_edited: false },
    },
  };

  console.log('Model: anthropic/claude-opus-4.6');
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

    const comparisonEnabled = ctx.input.comparison_enabled as boolean | undefined;
    const expectedObjects = ctx.input.comparison_objects as number | undefined;
    const expectedCriteria = ctx.input.comparison_criteria as number | undefined;
    // Паттерн блока сравнения: <p><strong>Название</strong></p> + <ul>
    const objPattern = /<p><strong>[^<]+<\/strong><\/p>\s*<ul>/g;
    const objMatches = html.match(objPattern) ?? [];
    // Подсчёт <li> только в блоке сравнения (между первым и последним таким паттерном)
    const firstObjIdx = html.search(/<p><strong>[^<]+<\/strong><\/p>\s*<ul>/);
    let liInComparison = 0;
    if (firstObjIdx >= 0) {
      // Находим конец блока сравнения (после последнего </ul> следующего за pattern)
      const compSlice = html.slice(firstObjIdx);
      const liMatches = compSlice.match(/<li>/g) ?? [];
      liInComparison = liMatches.length;
    }
    console.log(`\ncomparison_enabled: ${comparisonEnabled}`);
    if (comparisonEnabled) {
      const hasBlock = objMatches.length > 0;
      console.log(`comparison block present: ${hasBlock ? 'OK' : 'FAIL — block not found'}`);
      if (hasBlock && expectedObjects) {
        const objOk = objMatches.length >= expectedObjects;
        console.log(`objects found: ${objMatches.length} (expected ${expectedObjects}): ${objOk ? 'OK' : 'FAIL'}`);
      }
      if (hasBlock && expectedObjects && expectedCriteria) {
        const expectedLi = expectedObjects * expectedCriteria;
        const liOk = liInComparison >= expectedLi;
        console.log(`<li> in comparison: ${liInComparison} (expected ~${expectedLi} = ${expectedObjects}×${expectedCriteria}): ${liOk ? 'OK' : 'WARN — possibly trimmed'}`);
      }
    } else {
      const absent = objMatches.length === 0;
      console.log(`comparison block absent: ${absent ? 'OK' : 'FAIL — block found unexpectedly (count: ' + objMatches.length + ')'}`);
    }

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
