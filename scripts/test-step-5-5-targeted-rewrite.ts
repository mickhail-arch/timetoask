// scripts/test-step-5-5-targeted-rewrite.ts — тест точечного рерайта (Step 5.5)
// Запуск: npx tsx scripts/test-step-5-5-targeted-rewrite.ts

import { config } from 'dotenv';
config();

const MOCK_ARTICLE_HTML = `
<h1>Poizon что это: полный обзор платформы</h1>

<p>Poizon — это китайский маркетплейс, который специализируется на продаже оригинальной брендовой продукции. Платформа предлагает широкий ассортимент товаров от кроссовок до электроники. Каждый товар проходит обязательную проверку подлинности перед отправкой покупателю. Сервис завоевал доверие миллионов пользователей по всему миру.</p>

<h2>Как работает Poizon</h2>

<p>Стоит отметить, что платформа Poizon использует уникальную систему верификации товаров. Кроме того, каждый продавец проходит строгую проверку перед размещением на площадке. Более того, система рейтингов обеспечивает дополнительный контроль качества. Помимо этого, покупатели могут оставлять отзывы и фотографии полученных товаров. Важно подчеркнуть, что возврат товара возможен в течение семи дней после получения. При этом процесс возврата максимально упрощён и не требует дополнительных действий от покупателя.</p>

<p>Для начала работы с приложением нужно скачать его из App Store или Google Play, зарегистрироваться и привязать способ оплаты.</p>

<h2>Преимущества и недостатки</h2>

<p>Важно отметить, что главное преимущество Poizon — это гарантия оригинальности каждого товара. Кроме того, цены на платформе зачастую ниже, чем в официальных магазинах. Более того, ассортимент включает эксклюзивные модели, недоступные в российских магазинах. Помимо этого, приложение предоставляет удобный интерфейс для поиска и сравнения товаров. В свою очередь, недостатки связаны с длительными сроками доставки и возможными таможенными сборами. Безусловно, языковой барьер также может стать препятствием для некоторых пользователей.</p>

<h2>Доставка и оплата</h2>

<p>Доставка товаров с Poizon осуществляется международными курьерскими службами. Среднее время доставки в Россию составляет от 10 до 20 дней в зависимости от выбранного способа. Оплата принимается картами UnionPay и Alipay.</p>

<p>Несомненно, стоит отметить, что процесс оформления заказа на платформе является интуитивно понятным и удобным. Кроме того, платформа предоставляет подробные инструкции для новых пользователей. Более того, служба поддержки работает круглосуточно и оперативно решает возникающие вопросы. Помимо этого, система отслеживания посылок позволяет контролировать каждый этап доставки. При этом уведомления о статусе заказа приходят автоматически.</p>
`.trim();

async function main() {
  console.log('=== TEST: Step 5.5 — Targeted Rewrite ===\n');

  const { executeTargetedRewrite } = await import(
    '@/modules/seo/steps/step-5-5-targeted-rewrite'
  );

  const ctx: import('@/modules/seo/types').PipelineContext = {
    jobId: 'test-rewrite-001',
    userId: 'test-user',
    input: {
      target_query: 'poizon что это',
    },
    config: {
      models: { revisions: 'anthropic/claude-opus-4.6' },
    },
    data: {
      ai_detect_revisions: {
        article_html: MOCK_ARTICLE_HTML,
        final_ai_score: 55,
      },
    },
  };

  const lengthBefore = MOCK_ARTICLE_HTML.length;
  console.log('Model: anthropic/claude-opus-4.6');
  console.log('AI score: 55');
  console.log('Article length before:', lengthBefore);
  console.log('');

  try {
    const result = await executeTargetedRewrite(ctx);

    if (!result.success) {
      console.error('FAIL: executeTargetedRewrite returned success=false');
      console.error('Error:', result.error);
      console.log('\n=== RESULT: FAIL ===');
      process.exit(1);
    }

    const data = result.data;
    const articleAfter = data.article_html as string;
    const lengthAfter = articleAfter.length;
    const rewrittenCount = data.rewritten_count as number;
    const skipped = data.skipped as boolean;
    const warnings = data.warnings as string[];

    console.log('Skipped:', skipped);
    console.log('Paragraphs rewritten:', rewrittenCount);
    console.log('Length before:', lengthBefore);
    console.log('Length after:', lengthAfter);
    console.log('Delta:', lengthAfter - lengthBefore);

    if (warnings?.length) {
      console.log('\nWarnings:');
      for (const w of warnings) console.log('  WARN:', w);
    }

    console.log('\nDuration:', result.durationMs, 'ms');

    if (rewrittenCount === 0 && !skipped) {
      console.log('\nWARN: No paragraphs were rewritten despite ai_score > 25');
      console.log('\n=== RESULT: WARN ===');
    } else {
      console.log('\nOK: Targeted rewrite completed successfully');
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
