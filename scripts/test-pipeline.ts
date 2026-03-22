// scripts/test-pipeline.ts — тест pipeline без UI
// Запуск: npx tsx scripts/test-pipeline.ts

import { config } from 'dotenv';
config();

async function main() {
  const BASE = 'http://localhost:3000';
  
  // 1. Логин — получить session cookie
  console.log('--- Step 1: Login ---');
  const loginRes = await fetch(`${BASE}/api/auth/session`);
  const cookies = loginRes.headers.get('set-cookie') ?? '';
  console.log('Session status:', loginRes.status);
  
  // Используем cookie из браузера — скопируй из DevTools
  // Или передай через env: SESSION_COOKIE="next-auth.session-token=..."
  const sessionCookie = process.env.SESSION_COOKIE ?? '';
  if (!sessionCookie) {
    console.log('\n⚠️  Скопируй cookie из браузера:');
    console.log('  1. Открой http://localhost:3000 в браузере (залогинься)');
    console.log('  2. F12 → Application → Cookies → next-auth.session-token');
    console.log('  3. Запусти: SESSION_COOKIE="next-auth.session-token=VALUE" npx tsx scripts/test-pipeline.ts');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': sessionCookie,
  };

  // 2. Execute
  console.log('\n--- Step 2: Execute ---');
  const execRes = await fetch(`${BASE}/api/tools/seo-article-express/execute`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      input: {
        target_query: 'тест pipeline',
        keywords: 'тестовый ключ\nвторой ключ',
        intent: 'informational',
        target_char_count: 4000,
        image_count: 2,
        tone_of_voice: 'expert',
        target_audience: { gender: 'all', age: ['all'] },
        faq_count: 3,
      },
    }),
  });
  const execData = await execRes.json();
  console.log('Execute status:', execRes.status);
  console.log('Execute data:', JSON.stringify(execData, null, 2));
  
  if (!execData.data?.jobId) {
    console.log('❌ No jobId, aborting');
    return;
  }
  const jobId = execData.data.jobId;
  console.log('JobId:', jobId);

  // 3. Poll until awaiting_confirmation
  console.log('\n--- Step 3: Polling (analysis) ---');
  let state = await pollUntil(BASE, headers, jobId, ['awaiting_confirmation', 'completed', 'failed']);
  console.log('Status:', state.status, '| Step:', state.stepName, '| Progress:', state.progress + '%');
  
  if (state.status === 'failed') {
    console.log('❌ Pipeline failed:', state.error);
    return;
  }

  if (state.status === 'awaiting_confirmation') {
    console.log('Brief H1:', (state.brief as any)?.h1);
    console.log('H2 count:', (state.brief as any)?.h2_list?.length);
    console.log('Price:', state.calculatedPrice);

    // 4. Confirm
    console.log('\n--- Step 4: Confirm ---');
    const confirmRes = await fetch(`${BASE}/api/jobs/${jobId}/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        brief: state.brief,
        user_edited: false,
      }),
    });
    const confirmData = await confirmRes.json();
    console.log('Confirm status:', confirmRes.status, confirmData);

    // 5. Poll until completed
    console.log('\n--- Step 5: Polling (generation) ---');
    state = await pollUntil(BASE, headers, jobId, ['completed', 'failed'], 120, 3000);
    console.log('Status:', state.status, '| Step:', state.stepName, '| Progress:', state.progress + '%');
  }

  if (state.status === 'completed') {
    console.log('\n--- Pipeline COMPLETED ---');
    const result = state.result as any;
    const assembly = result?.assembly;
    if (assembly) {
      console.log('Article length:', assembly.article_html?.length, 'chars');
      console.log('Title:', assembly.metadata?.title);
      console.log('Slug:', assembly.metadata?.slug);
      console.log('AI score:', assembly.qualityMetrics?.ai_score);
      console.log('Warnings:', assembly.warnings);

      // Image checks
      const images = result?.images;
      console.log('\n--- Image Results ---');
      console.log('images_generated:', images?.images_generated ?? 'N/A');
      console.log('images_total:', images?.images_total ?? 'N/A');
      const altTexts = images?.alt_texts as string[] | undefined;
      if (altTexts?.length) {
        console.log('alt_texts:');
        for (const alt of altTexts) console.log('  ', alt.slice(0, 100));
      }

      const html = assembly.article_html as string ?? '';
      const figureCount = (html.match(/<figure/gi) ?? []).length;
      const imgCount = (html.match(/<img/gi) ?? []).length;
      console.log('\n--- HTML Image Tags ---');
      console.log('<figure> tags:', figureCount);
      console.log('<img> tags:', imgCount);
      if (figureCount === 0 && imgCount === 0) {
        console.log('WARN: No image tags found in final article_html');
      } else {
        console.log('OK: Image tags present in article');
      }
    } else {
      console.log('Result keys:', Object.keys(result ?? {}));
    }
  } else {
    console.log('FAIL: Pipeline failed:', state.error);
  }
}

async function pollUntil(
  base: string,
  headers: Record<string, string>,
  jobId: string,
  stopStatuses: string[],
  maxAttempts = 60,
  intervalMs = 3000,
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${base}/api/jobs/${jobId}/status`, { headers });
    const json = await res.json();
    const state = json.data;
    
    process.stdout.write(`  [${i + 1}] ${state.status} | ${state.stepName} | ${state.progress}%\r`);
    
    if (stopStatuses.includes(state.status)) {
      console.log();
      return state;
    }
    
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Polling timeout');
}

main().catch(console.error);
