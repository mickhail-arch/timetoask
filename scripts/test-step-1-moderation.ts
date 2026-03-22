// scripts/test-step-1-moderation.ts — тест модерации (Step 1)
// Запуск: npx tsx scripts/test-step-1-moderation.ts

import { config } from 'dotenv';
config();

async function main() {
  console.log('=== TEST: Step 1 — Moderation ===\n');

  const { llmModerate } = await import('@/adapters/moderation');

  const testText = 'poizon что это, как работает платформа';
  const model = 'google/gemini-2.5-flash';

  console.log(`Input: "${testText}"`);
  console.log(`Model: ${model}\n`);

  try {
    const result = await llmModerate(testText, model);

    console.log('Category:', result.category);
    console.log('Reason:', result.reason ?? '(none)');

    if (result.category === 'A') {
      console.log('\nWARN: Content blocked (category A)');
      console.log('\n=== RESULT: WARN ===');
    } else {
      console.log(`\nOK: Moderation passed with category "${result.category}"`);
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
