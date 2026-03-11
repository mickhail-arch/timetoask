# Архитектура проекта
 
## Стек
TypeScript 5.x (strict) · Next.js 16.1.x · React 19.2.x
PostgreSQL 16 · Prisma 7.x · Redis 7.x · OpenRouter
NextAuth v4 · ЮKassa · Tailwind CSS 4.x · shadcn/ui
 
## Слои (зависимости строго сверху вниз)
core/   	← типы, ошибки, env, константы — ничего не импортирует
adapters/   ← внешние API (LLM, payments, email) — только из core/
modules/	← бизнес-логика, чистый TS — из core/ + adapters/
plugins/	← инструменты (7 файлов каждый) — из core/ + modules/
apps/   	← Next.js routes + frontend — из всего выше
 
## Главные запреты
- new PrismaClient() ТОЛЬКО в lib/prisma.ts
- Логика ТОЛЬКО в modules/*.service.ts, не в route.ts
- Prisma/Redis ЗАПРЕЩЕНЫ в middleware.ts (Edge Runtime)
- import from 'next' ЗАПРЕЩЁН в modules/
- Счётчики конкурентности ТОЛЬКО через Redis INCR/DECR
 
## Монетизация
Free-tier (free_uses_limit на инструмент) + Token-based billing
Паттерн: Reserve → Execute → Finalize (Serializable transaction)
 
## Инструменты
executionMode: sync → SSE-стрим (<30 сек)
executionMode: async → jobId + polling GET /api/jobs/:id/status
