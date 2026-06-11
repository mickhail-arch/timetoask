// scripts/check-read-json.ts — проверка лимита размера тела
import 'dotenv/config';
import { readJson } from '@/lib/read-json';
import { PayloadTooLargeError } from '@/core/errors';

function makeReq(body: string): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
}

async function main() {
  let ok = true;

  const small = await readJson<{ a: number }>(makeReq(JSON.stringify({ a: 1 })), 1024);
  const okSmall = small.a === 1;
  console.log(`${okSmall ? 'OK  ' : 'FAIL'} маленький JSON распарсился (a=${small.a})`);
  ok = ok && okSmall;

  let threw = false;
  try {
    await readJson(makeReq(JSON.stringify({ s: 'x'.repeat(5000) })), 1024);
  } catch (e) {
    threw = e instanceof PayloadTooLargeError;
  }
  console.log(`${threw ? 'OK  ' : 'FAIL'} большой payload отклонён (PayloadTooLargeError)`);
  ok = ok && threw;

  console.log(ok ? 'РЕЗУЛЬТАТ: OK' : 'РЕЗУЛЬТАТ: ПРОВАЛ');
  process.exit(ok ? 0 : 1);
}
main();