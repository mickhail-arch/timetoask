// scripts/test-step-5-revisions.ts — тест AI-детект + правки (Step 5)
// Запуск: npx tsx scripts/test-step-5-revisions.ts

import { config } from 'dotenv';
config();

async function main() {
  console.log('=== TEST: Step 5 — AI Detect & Revisions ===\n');

  const { executeAiDetectRevisions } = await import('@/modules/seo/steps/step-5-ai-detect-revisions');

  const articleHtml = buildMockArticle();
  const originalLength = articleHtml.replace(/<[^>]*>/g, '').length;
  console.log('Original article text length:', originalLength, 'chars');
  console.log('Models: ai_detect=anthropic/claude-opus-4.6, revisions=anthropic/claude-opus-4.6');
  console.log('');

  const ctx: import('@/modules/seo/types').PipelineContext = {
    jobId: 'test-revisions-001',
    userId: 'test-user',
    input: {
      target_query: 'poizon что это',
      keywords: 'poizon\nпойзон приложение',
      intent: 'informational',
      target_char_count: 5000,
      image_count: 2,
      faq_count: 3,
    },
    config: {
      models: {
        ai_detect: 'anthropic/claude-opus-4.6',
        revisions: 'anthropic/claude-opus-4.6',
      },
    },
    data: {
      draft: { article_html: articleHtml },
      seo_audit: { seo_issues: [], qualityMetrics: {} },
    },
  };

  try {
    const result = await executeAiDetectRevisions(ctx);

    if (!result.success) {
      console.error('FAIL: executeAiDetectRevisions returned success=false');
      console.error('Error:', result.error);
      console.log('\n=== RESULT: FAIL ===');
      process.exit(1);
    }

    const data = result.data;
    const revisedHtml = data.article_html as string;
    const revisedLength = revisedHtml.replace(/<[^>]*>/g, '').length;

    console.log('first_ai_score:', data.first_ai_score);
    console.log('final_ai_score:', data.final_ai_score);
    console.log('issues_fixed:', data.issues_fixed);
    console.log('');
    console.log('article_html length BEFORE:', originalLength, 'chars');
    console.log('article_html length AFTER:', revisedLength, 'chars');
    console.log('Change:', revisedLength - originalLength, 'chars');
    console.log(`Change %: ${(((revisedLength - originalLength) / originalLength) * 100).toFixed(1)}%`);

    const isRollback = revisedLength === originalLength;
    console.log(`\nRollback: ${isRollback ? 'YES (article unchanged)' : 'NO (article modified)'}`);

    const warnings = data.warnings as string[];
    const rollbackIterations = warnings?.filter(w => w.includes('Правки откачены')).length ?? 0;
    console.log(`Rollback iterations (warnings "Правки откачены"): ${rollbackIterations}`);

    if (warnings?.length) {
      console.log('\nWarnings:');
      for (const w of warnings) console.log('  WARN:', w);
    }

    console.log('\nDuration:', result.durationMs, 'ms');

    const finalScore = data.final_ai_score as number;
    if (finalScore > 50) {
      console.log(`\nWARN: AI score ${finalScore}% is high`);
      console.log('\n=== RESULT: WARN ===');
    } else {
      console.log('\nOK: AI detect & revisions completed');
      console.log('\n=== RESULT: OK ===');
    }
  } catch (err) {
    console.error('\nFAIL:', err instanceof Error ? err.message : err);
    if (err instanceof Error) console.error('Stack:', err.stack);
    console.log('\n=== RESULT: FAIL ===');
    process.exit(1);
  }
}

function buildMockArticle(): string {
  return `<h1>Poizon что это: полный обзор платформы</h1>
<p>Платформа poizon что это — вопрос, который задают тысячи покупателей. Poizon представляет собой крупнейший маркетплейс оригинальных товаров из Китая. Каждый товар проходит многоступенчатую проверку подлинности. Сервис работает через мобильное приложение для Android и iOS. За последние два года количество пользователей выросло в три раза.</p>
[IMAGE_1]
[IMAGE_1_DESC: Мобильное приложение Poizon на экране смартфона]
<h2>Как работает Poizon</h2>
<p>Принцип работы платформы достаточно прост. Продавцы размещают товары, а покупатели выбирают из каталога. Перед отправкой каждая вещь проверяется экспертами на подлинность. Это главное отличие от обычных маркетплейсов, где верификация отсутствует. Пойзон приложение позволяет отслеживать статус проверки в реальном времени.</p>
<h3>Регистрация и первые шаги</h3>
<p>Для регистрации потребуется номер телефона и электронная почта. После подтверждения аккаунта открывается доступ ко всему каталогу. Рекомендуется заполнить профиль и указать адрес доставки заранее. Это ускорит оформление первого заказа примерно на 5 минут.</p>
<h3>Поиск и заказ товаров</h3>
<p>Каталог содержит более 50 000 позиций от проверенных продавцов. Фильтры позволяют отсортировать по бренду, размеру и цене. Средний чек составляет от 5000 до 25000 рублей. После оплаты товар поступает на склад верификации в течение 2-3 дней.</p>
[IMAGE_2]
[IMAGE_2_DESC: Процесс поиска товаров в приложении Poizon]
<h2>Преимущества и недостатки Poizon</h2>
<p>Среди преимуществ выделяются гарантия подлинности и широкий ассортимент. К недостаткам относят длительную доставку и возможные сложности с возвратом. Однако для большинства покупателей плюсы перевешивают минусы. Платформа регулярно улучшает логистику и сокращает сроки доставки.</p>
<h3>Гарантия оригинальности</h3>
<p>Каждый товар проходит проверку командой из 200 экспертов. Используются специализированные инструменты и базы данных производителей. При обнаружении подделки заказ автоматически отменяется, а продавец получает штраф. За 2024 год было выявлено и заблокировано более 15000 поддельных товаров.</p>
<h2>Часто задаваемые вопросы</h2>
<h3>Что такое Poizon и для чего он нужен?</h3>
<p>Poizon — это маркетплейс оригинальных товаров из Китая с системой верификации подлинности каждого товара перед отправкой.</p>
<h3>Как заказать товар через Poizon?</h3>
<p>Скачайте пойзон приложение, зарегистрируйтесь, выберите товар из каталога и оплатите его банковской картой.</p>
<h3>Сколько стоит доставка из Poizon?</h3>
<p>Стоимость доставки зависит от веса и составляет от 500 до 2000 рублей. Среднее время — 10-20 рабочих дней.</p>`;
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  console.log('\n=== RESULT: FAIL ===');
  process.exit(1);
});
