// scripts/test-step-7-assembly.ts — тест финальной сборки (Step 7)
// Запуск: npx tsx scripts/test-step-7-assembly.ts

import { config } from 'dotenv';
config();

async function main() {
  console.log('=== TEST: Step 7 — Assembly ===\n');

  const { executeAssembly } = await import('@/modules/seo/steps/step-7-assembly');

  const articleHtml = `<h1>Poizon что это: полный обзор платформы</h1>
<p>Платформа Poizon представляет собой крупнейший маркетплейс оригинальных товаров из Китая. Каждый товар проходит многоступенчатую проверку подлинности перед отправкой покупателю. Сервис работает через мобильное приложение, доступное для Android и iOS. За последние два года количество пользователей выросло в три раза.</p>
<figure><img src="data:image/png;base64,dGVzdA==" alt="poizon что это приложение" loading="lazy"></figure>
<h2>Как работает Poizon</h2>
<p>Принцип работы платформы достаточно прост. Продавцы размещают товары, а покупатели выбирают из каталога. Перед отправкой каждая вещь проверяется экспертами на подлинность. Это главное отличие от обычных маркетплейсов, где верификация отсутствует. Пойзон приложение позволяет отслеживать статус проверки в реальном времени. Средний чек составляет от 5000 до 25000 рублей.</p>
<h3>Регистрация и первые шаги</h3>
<p>Для регистрации потребуется номер телефона и электронная почта. После подтверждения аккаунта открывается доступ ко всему каталогу. Рекомендуется заполнить профиль и указать адрес доставки заранее.</p>
<h3>Поиск и заказ товаров</h3>
<p>Каталог содержит более 50 000 позиций от проверенных продавцов. Фильтры позволяют отсортировать по бренду, размеру и цене.</p>
<figure><img src="data:image/png;base64,dGVzdA==" alt="пойзон приложение каталог" loading="lazy"></figure>
<h2>Преимущества и недостатки Poizon</h2>
<p>Среди преимуществ выделяются гарантия подлинности и широкий ассортимент. К недостаткам относят длительную доставку и возможные сложности с возвратом. Однако для большинства покупателей плюсы перевешивают минусы.</p>
<h3>Гарантия оригинальности</h3>
<p>Каждый товар проходит проверку командой из 200 экспертов. Используются специализированные инструменты и базы данных производителей. При обнаружении подделки заказ автоматически отменяется.</p>
<h2>Часто задаваемые вопросы</h2>
<h3>Что такое Poizon и для чего он нужен?</h3>
<p>Poizon — это маркетплейс оригинальных товаров из Китая с системой верификации подлинности каждого товара перед отправкой.</p>
<h3>Как заказать товар через Poizon?</h3>
<p>Скачайте приложение, зарегистрируйтесь, выберите товар из каталога и оплатите его банковской картой.</p>
<h3>Сколько стоит доставка из Poizon?</h3>
<p>Стоимость доставки зависит от веса и составляет от 500 до 2000 рублей. Среднее время — 10-20 рабочих дней.</p>`;

  const ctx: import('@/modules/seo/types').PipelineContext = {
    jobId: 'test-assembly-001',
    userId: 'test-user',
    input: {
      target_query: 'poizon что это',
      keywords: 'poizon\nпойзон приложение',
      intent: 'informational',
      target_char_count: 5000,
      image_count: 2,
      faq_count: 3,
      brand: 'TestBrand',
      brand_url: 'https://testbrand.ru',
      cta: 'Купите сейчас',
      cta_url: 'https://testbrand.ru/buy',
    },
    config: {
      models: { assembly: 'anthropic/claude-opus-4.6' },
    },
    data: {
      moderation: { category: 'OK', add_disclaimer: false },
      images: {
        article_html: articleHtml,
        alt_texts: ['poizon что это приложение', 'пойзон приложение каталог'],
        warnings: [],
      },
      ai_detect_revisions: {
        article_html: articleHtml,
        qualityMetrics: {
          ai_score: 28,
          water: 18,
          spam: 35,
          nausea_classic: 5.2,
          nausea_academic: 4.1,
          uniqueness: 85,
          readability: 8.5,
          char_count: 2800,
          word_count: 380,
          h2_count: 3,
          h3_count: 5,
          image_count: 2,
          faq_count: 3,
        },
        warnings: [],
      },
      seo_audit: {
        qualityMetrics: {
          ai_score: 0,
          water: 18,
          spam: 35,
          nausea_classic: 5.2,
          nausea_academic: 4.1,
          uniqueness: 85,
          readability: 8.5,
          char_count: 2800,
          word_count: 380,
          h2_count: 3,
          h3_count: 5,
          image_count: 2,
          faq_count: 3,
        },
      },
    },
  };

  try {
    const result = await executeAssembly(ctx);

    if (!result.success) {
      console.error('FAIL: executeAssembly returned success=false');
      console.error('Error:', result.error);
      console.log('\n=== RESULT: FAIL ===');
      process.exit(1);
    }

    const data = result.data;
    const metadata = data.metadata as Record<string, unknown>;
    const schemas = data.schemas as unknown[];

    console.log('--- Metadata ---');
    console.log('title:', metadata.title, `(${(metadata.title as string).length} chars)`);
    console.log('description:', metadata.description, `(${(metadata.description as string).length} chars)`);
    console.log('slug:', metadata.slug);
    console.log('breadcrumb:', metadata.breadcrumb);

    console.log('\n--- Schemas ---');
    console.log('schemas count:', schemas.length);
    const jsonLd = metadata.json_ld as string;
    console.log('json_ld length:', jsonLd.length, 'chars');

    for (const schema of schemas) {
      const s = schema as Record<string, unknown>;
      console.log(`  Schema: ${s['@type']}`);
    }

    const hasBreadcrumb = schemas.some(
      (s) => (s as Record<string, unknown>)['@type'] === 'BreadcrumbList',
    );
    console.log(`BreadcrumbList in schemas: ${hasBreadcrumb ? 'OK' : 'FAIL'}`);

    console.log('\n--- Validation ---');
    const titleLen = (metadata.title as string).length;
    const titleOk = titleLen >= 55 && titleLen <= 60;
    console.log(`title length: ${titleLen} chars ${titleOk ? 'OK (55-60)' : 'FAIL (expected 55-60)'}`);

    const desc = metadata.description as string;
    const descLen = desc.length;
    const descOk = descLen >= 150 && descLen <= 160;
    console.log(`description length: ${descLen} chars ${descOk ? 'OK (150-160)' : 'FAIL (expected 150-160)'}`);

    const descHasNewline = desc.includes('\n');
    console.log(`description contains \\n: ${descHasNewline ? 'FAIL' : 'OK'}`);

    const slug = metadata.slug as string;
    const slugNotEmpty = slug && slug.length > 0;
    const slugWords = slug.split('-');
    const slugHasDupes = slugWords.length !== new Set(slugWords).size;
    console.log(`slug: "${slug}"`);
    console.log(`slug not empty: ${slugNotEmpty ? 'OK' : 'FAIL'}`);
    console.log(`slug no duplicate words: ${slugHasDupes ? 'FAIL' : 'OK'}`);

    const html = data.article_html as string;
    console.log('\n--- HTML ---');
    console.log('article_html length:', html.length, 'chars');
    console.log('Has <article> wrapper:', html.includes('<article'));
    console.log('Has inline styles:', html.includes('style='));

    const warnings = data.warnings as string[];
    if (warnings?.length) {
      console.log('\nWarnings:');
      for (const w of warnings) console.log('  WARN:', w);
    }

    console.log('\nDuration:', result.durationMs, 'ms');
    console.log('\nOK: Assembly completed successfully');
    console.log('\n=== RESULT: OK ===');
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
