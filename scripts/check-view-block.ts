// scripts/check-view-block.ts — проверка правила блокировки view-impersonation
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function shouldBlock(path: string, method: string, level: string | null): boolean {
  if (!path.startsWith('/api/')) return false;
  if (!MUTATING.has(method)) return false;
  if (path.startsWith('/api/admin/impersonate')) return false;
  return level === 'view';
}

const cases: [string, string, string | null, boolean][] = [
  ['/api/tools/x/execute', 'POST', 'view', true],          // view + мутация → блок
  ['/api/tools/x/execute', 'GET', 'view', false],          // чтение разрешено
  ['/api/tools/x/execute', 'POST', 'full', false],         // full-импер — можно
  ['/api/tools/x/execute', 'POST', null, false],           // обычный юзер — можно
  ['/api/admin/impersonate/stop', 'POST', 'view', false],  // выход из импер — разрешён
  ['/dashboard', 'POST', 'view', false],                   // не api — не трогаем
];

let ok = true;
for (const [p, m, lvl, expected] of cases) {
  const got = shouldBlock(p, m, lvl);
  const pass = got === expected;
  if (!pass) ok = false;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${m} ${p} level=${lvl} → block=${got} (ждём ${expected})`);
}
console.log(ok ? 'РЕЗУЛЬТАТ: OK' : 'РЕЗУЛЬТАТ: ПРОВАЛ');
process.exit(ok ? 0 : 1);
