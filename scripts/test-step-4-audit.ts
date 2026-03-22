// scripts/test-step-4-audit.ts — тест SEO-аудита (Step 4)
// Запуск: npx tsx scripts/test-step-4-audit.ts

import { config } from 'dotenv';
config();

function filler(base: string, targetLen: number): string {
  let result = base;
  while (result.length < targetLen) result += ' ' + base;
  return result.slice(0, targetLen);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function buildMockArticle(): string {
  const intro = filler(
    'poizon что это удобная платформа для покупки оригинальных товаров из Китая с проверкой подлинности',
    250,
  );

  const pSame = (n: number) =>
    filler(`Платформа Poizon предоставляет возможности для покупателей часть ${n}`, 500);
  const pOther = (n: number) =>
    filler(`Товары проходят проверку подлинности перед отправкой покупателю часть ${n}`, 500);

  const advP = (n: number) =>
    filler(`Качество обслуживания подтверждается отзывами покупателей вариант ${n}`, 500);
  const regP = filler('Процесс регистрации занимает минимум времени и не требует сложных действий', 300);
  const funcP = filler('Функционал приложения позволяет отслеживать заказы и управлять доставкой', 300);

  const faq1 = filler('Подробный ответ на вопрос о работе платформы и её возможностях для пользователей', 650);
  const faq2 = filler('Ответ на второй вопрос кратко', 200);
  const faq3 = filler('Короткий ответ', 70);

  return [
    '<h1>poizon что это</h1>',
    `<p>${intro}</p>`,
    '[IMAGE_1]',
    '<h2>Как работает Poizon</h2>',
    `<p>${pSame(1)}</p>`,
    `<p>${pSame(2)}</p>`,
    `<p>${pSame(3)}</p>`,
    `<p>${pOther(1)}</p>`,
    `<p>${pOther(2)}</p>`,
    `<p>${pOther(3)}</p>`,
    '<h2>Преимущества</h2>',
    `<p>${advP(1)}</p>`,
    `<p>${advP(2)}</p>`,
    '[IMAGE_2]',
    '<h3>Регистрация</h3>',
    `<p>${regP}</p>`,
    '<h3>Функции</h3>',
    `<p>${funcP}</p>`,
    '<h2>Часто задаваемые вопросы</h2>',
    `<h3>Вопрос 1</h3>`,
    `<p>${faq1}</p>`,
    `<h3>Вопрос 2</h3>`,
    `<p>${faq2}</p>`,
    `<h3>Вопрос 3</h3>`,
    `<p>${faq3}</p>`,
  ].join('\n');
}

async function main() {
  console.log('=== TEST: Step 4 — SEO Audit ===\n');

  const { executeSeoAudit } = await import('@/modules/seo/steps/step-4-seo-audit');

  const articleHtml = buildMockArticle();
  const textLength = stripTags(articleHtml).length;
  console.log('Mock article text length:', textLength, 'chars\n');

  const ctx: import('@/modules/seo/types').PipelineContext = {
    jobId: 'test-audit-001',
    userId: 'test-user',
    input: {
      target_query: 'poizon что это',
      keywords: 'poizon\nпойзон приложение',
      intent: 'informational',
      target_char_count: textLength,
      image_count: 2,
      faq_count: 3,
    },
    config: null,
    data: {
      draft: { article_html: articleHtml },
    },
  };

  try {
    const result = await executeSeoAudit(ctx);

    if (!result.success) {
      console.error('FAIL: executeSeoAudit returned success=false');
      console.error('Error:', result.error);
      console.log('\n=== RESULT: FAIL ===');
      process.exit(1);
    }

    const data = result.data;
    const issues = data.seo_issues as Array<{ severity: string; message: string; group: string }>;

    console.log('--- SEO Issues ---');
    console.log(`Critical: ${data.critical_count}`);
    console.log(`Warning:  ${data.warning_count}`);
    console.log(`Info:     ${issues.filter(i => i.severity === 'info').length}`);
    console.log(`Total:    ${issues.length}\n`);

    for (const issue of issues) {
      const tag = issue.severity === 'critical' ? 'CRIT' : issue.severity === 'warning' ? 'WARN' : 'INFO';
      console.log(`  [${tag}] [${issue.group}] ${issue.message}`);
    }

    console.log('\n--- Quality Metrics ---');
    const qm = data.qualityMetrics as Record<string, number>;
    for (const [key, value] of Object.entries(qm)) {
      console.log(`  ${key}: ${value}`);
    }

    console.log(`\nDuration: ${result.durationMs} ms`);

    console.log('\n--- Validation ---');
    const expectedPatterns: [string, string][] = [
      ['faq', 'слишком длинный'],
      ['faq', 'слишком короткий'],
      ['quality', 'Одинаковое начало абзацев'],
      ['keywords', 'пойзон приложение'],
    ];

    let allFound = true;
    for (const [group, substr] of expectedPatterns) {
      const found = issues.some(i => i.group === group && i.message.includes(substr));
      const mark = found ? 'OK' : 'MISSING';
      if (!found) allFound = false;
      console.log(`  [${mark}] group="${group}" contains "${substr}"`);
    }

    console.log(allFound ? '\n=== RESULT: OK ===' : '\n=== RESULT: WARN (expected issues missing) ===');
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
