# Timetoask — Браузерный SaaS с AI-маркетинговыми инструментами

## Быстрый старт
cp .env.example .env  # заполнить все переменные
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev

## Структура
PROJECT_CONTEXT.md — полный контекст проекта для AI-ассистента (обновлять после каждой сессии)
ARCHITECTURE.md    — карта слоёв и главные запреты
.cursorrules       — правила для Cursor AI
core/              — типы, ошибки, env, константы
adapters/          — внешние API (OpenRouter, Winston AI, ЮKassa, SMTP, Serper, Cheerio)
modules/           — бизнес-логика (auth, user, billing, llm, admin, notifications, seo)
plugins/           — инструменты (7 файлов каждый)
app/               — Next.js 16 routes и frontend
components/        — UI-компоненты (ui/, app/, seo-article/, dashboard/)
hooks/             — React hooks (useTools, useBalance, useSeoJobPolling, useSessionHistory)
lib/               — синглтоны (prisma, redis, auth, concurrency)
prisma/            — схема БД (12 моделей) и миграции
scripts/           — тестовые скрипты и утилиты
workers/           — фоновые задачи

## Активные инструменты
- seo-article-express — SEO-генератор статей (async, 9-шаговый пайплайн)

## Команды
pnpm dev              — dev-сервер (Turbopack)
pnpm build            — production build
pnpm lint             — ESLint
pnpm prisma:generate  — генерация Prisma Client
pnpm prisma:migrate   — миграции
pnpm prisma:seed      — заполнение начальными данными
