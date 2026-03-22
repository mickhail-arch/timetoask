// scripts/test-step-6-images.ts — тест генерации изображений (Step 6, самый важный)
// Запуск: npx tsx scripts/test-step-6-images.ts

import { config } from 'dotenv';
config();

async function main() {
  console.log('=== TEST: Step 6 — Images ===\n');

  const { generateText, generateImage } = await import('@/adapters/llm/openrouter.adapter');
  const { executeImages } = await import('@/modules/seo/steps/step-6-images');

  // -------------------------------------------------------
  // Part A: Standalone generateText + generateImage test
  // -------------------------------------------------------
  console.log('--- Part A: Standalone image generation ---\n');

  let imagePrompt: string;

  // A.1: Generate image prompt via LLM
  console.log('A.1: Generating image prompt via generateText...');
  try {
    imagePrompt = await generateText({
      model: 'google/gemini-2.5-flash',
      systemPrompt: 'Generate a detailed image generation prompt in English. Output ONLY the prompt text. Max 200 words.',
      userMessage: 'Scene description: Мобильное приложение Poizon на экране смартфона\nStyle: photorealistic\nTopic: Poizon',
    });
    console.log('OK: Image prompt generated');
    console.log('Prompt:', imagePrompt.slice(0, 200) + (imagePrompt.length > 200 ? '...' : ''));
    console.log('');
  } catch (err) {
    console.error('FAIL: generateText failed:', err instanceof Error ? err.message : err);
    if (err instanceof Error) console.error('Stack:', err.stack);
    console.log('\n=== RESULT: FAIL ===');
    process.exit(1);
  }

  // A.2: Generate image
  console.log('A.2: Generating image via generateImage...');
  try {
    const imageResult = await generateImage({
      model: 'google/gemini-3.1-flash-image-preview',
      prompt: imagePrompt,
      size: '1792x1024',
    });

    console.log('OK: Image generated');
    console.log('url:', imageResult.url ? imageResult.url.slice(0, 100) + '...' : '(none)');
    console.log('b64_json:', imageResult.b64_json ? `present (${imageResult.b64_json.length} chars)` : '(none)');

    // A.3: Verify result
    if (!imageResult.url && !imageResult.b64_json) {
      console.log('FAIL: Neither url nor b64_json present');
      console.log('\n=== RESULT: FAIL ===');
      process.exit(1);
    }
    console.log('OK: Image result has valid data');
    console.log('');
  } catch (err) {
    console.error('FAIL: generateImage failed:', err instanceof Error ? err.message : err);
    if (err instanceof Error) console.error('Stack:', err.stack);
    console.log('\n=== RESULT: FAIL ===');
    process.exit(1);
  }

  // -------------------------------------------------------
  // Part B: Full executeImages with mock context
  // -------------------------------------------------------
  console.log('--- Part B: Full executeImages step ---\n');

  const articleHtml = `<h1>Poizon что это: полный обзор платформы</h1>
<p>Платформа Poizon представляет собой крупнейший маркетплейс оригинальных товаров из Китая. Каждый товар проходит проверку подлинности перед отправкой покупателю. Сервис работает через мобильное приложение.</p>
[IMAGE_1]
[IMAGE_1_DESC: Мобильное приложение Poizon на экране смартфона с каталогом товаров]
<h2>Как работает Poizon</h2>
<p>Принцип работы достаточно прост. Продавцы размещают товары, покупатели выбирают из каталога. Перед отправкой каждая вещь проверяется экспертами на подлинность.</p>
[IMAGE_2]
[IMAGE_2_DESC: Процесс верификации товара экспертами на складе Poizon]
<h2>Преимущества платформы</h2>
<p>Гарантия подлинности и широкий ассортимент — главные плюсы Poizon для покупателей из России.</p>`;

  const ctx: import('@/modules/seo/types').PipelineContext = {
    jobId: 'test-images-001',
    userId: 'test-user',
    input: {
      target_query: 'poizon что это',
      keywords: 'poizon\nпойзон приложение',
      image_count: 2,
      image_style: 'realistic',
    },
    config: {
      models: {
        image_prompt: 'google/gemini-2.5-flash',
        image_gen: 'google/gemini-3.1-flash-image-preview',
      },
    },
    data: {
      ai_detect_revisions: { article_html: articleHtml },
    },
  };

  try {
    const result = await executeImages(ctx);

    if (!result.success) {
      console.error('FAIL: executeImages returned success=false');
      console.error('Error:', result.error);
      console.log('\n=== RESULT: FAIL ===');
      process.exit(1);
    }

    const data = result.data;

    console.log('images_generated:', data.images_generated);
    console.log('images_total:', data.images_total);

    const altTexts = data.alt_texts as string[];
    console.log('alt_texts:', altTexts?.length ?? 0);
    for (const alt of altTexts ?? []) {
      console.log('  alt:', alt.slice(0, 100));
    }

    const warnings = data.warnings as string[];
    if (warnings?.length) {
      console.log('\nWarnings:');
      for (const w of warnings) console.log('  WARN:', w);
    }

    const finalHtml = data.article_html as string;
    const hasFigure = (finalHtml.match(/<figure/gi) ?? []).length;
    const hasImg = (finalHtml.match(/<img/gi) ?? []).length;
    console.log('\n<figure> tags in output:', hasFigure);
    console.log('<img> tags in output:', hasImg);
    console.log('Remaining [IMAGE_N] markers:', (finalHtml.match(/\[IMAGE_\d+\]/g) ?? []).length);

    console.log('\nDuration:', result.durationMs, 'ms');

    const generated = data.images_generated as number;
    if (generated === 0) {
      console.log('\nFAIL: No images generated');
      console.log('\n=== RESULT: FAIL ===');
      process.exit(1);
    } else if (generated < (data.images_total as number)) {
      console.log(`\nWARN: Generated ${generated}/${data.images_total} images`);
      console.log('\n=== RESULT: WARN ===');
    } else {
      console.log('\nOK: All images generated successfully');
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
