# app/api/ — Route Handlers (Next.js)
 
ПРАВИЛО: Route Handler = 10 строк максимум.
parse → service → response. Вся логика в modules/.
 
Структура каждого handler:
  1. getServerSession(authOptions) — авторизация
  2. schema.parse(body) — валидация входа
  3. Service.method() — один вызов сервиса
  4. NextResponse.json({ data }) — ответ
 
Формат успешного ответа:  { data: T }
Формат ошибки:            { error: { code, message, statusCode } }
 
Исключения:
  tools/:id/execute — SSE стрим или { jobId } для async
  billing/webhook   — без auth, без CORS (сервер ЮKassa)
 
middleware.ts — ТОЛЬКО cookie check + redirect. Edge Runtime.
instrumentation.ts — инициализация при старте (registry, cleanup).
