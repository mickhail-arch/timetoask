// scripts/test-step-2-brief.ts — тест генерации ТЗ (Step 2)
// Запуск: npx tsx scripts/test-step-2-brief.ts

import { config } from 'dotenv';
config();

async function main() {
  console.log('=== TEST: Step 2 — Brief ===\n');

  const { executeBrief } = await import('@/modules/seo/steps/step-1-2-brief');

  const ctx: import('@/modules/seo/types').PipelineContext = {
    jobId: 'test-brief-001',
    userId: 'test-user',
    input: {
      target_query: 'poizon что это',
      keywords: 'poizon\nпойзон приложение',
      intent: 'informational',
      target_char_count: 5000,
      image_count: 2,
      faq_count: 3,
      tone_of_voice: 'expert',
    },
    config: {
      models: { brief: 'google/gemini-2.5-flash' },
    },
    data: {},
  };

  console.log('Target query:', ctx.input.target_query);
  console.log('Model: google/gemini-2.5-flash');
  console.log('Char count:', ctx.input.target_char_count);
  console.log('');

  try {
    const result = await executeBrief(ctx);

    if (!result.success) {
      console.error('FAIL: executeBrief returned success=false');
      console.error('Error:', result.error);
      console.log('\n=== RESULT: FAIL ===');
      process.exit(1);
    }

    const data = result.data;
    console.log('H1:', data.h1);
    console.log('');

    const h2List = data.h2_list as Array<{ text: string; h3s: string[]; thesis?: string; facts?: string[] }>;
    console.log(`H2 count: ${h2List?.length ?? 0}`);
    for (const h2 of h2List ?? []) {
      console.log(`  H2: ${h2.text}`);
      for (const h3 of h2.h3s ?? []) {
        console.log(`    H3: ${h3}`);
      }
      console.log(`    Thesis: ${h2.thesis ?? '(none)'}`);
      console.log(`    Facts: ${h2.facts?.join('; ') ?? '(none)'}`);
    }

    const lsiKeywords = data.lsi_keywords as string[];
    console.log(`\nLSI keywords: ${lsiKeywords?.length ?? 0}`);
    if (lsiKeywords?.length) {
      console.log('  ', lsiKeywords.join(', '));
    }

    console.log('\nrequiresConfirmation:', result.requiresConfirmation);
    console.log('calculatedPrice:', data.calculatedPrice);
    console.log('Duration:', result.durationMs, 'ms');

    console.log('\nOK: Brief generated successfully');
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
