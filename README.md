📄  README.md (корень проекта)
# MarketingAI — Браузерный SaaS-враппер
 
## Быстрый старт
cp .env.example .env  # заполнить все переменные
pnpm install
pnpm prisma migrate dev
pnpm dev
 
## Структура
ARCHITECTURE.md   — карта слоёв и главные запреты
.cursorrules  	— правила для Cursor AI
core/         	— типы, ошибки, env
adapters/     	— внешние API
modules/      	— бизнес-логика
plugins/      	— инструменты (7 файлов каждый)
app/          	— Next.js routes и frontend
prisma/       	— схема БД и миграции
 
## Команды
pnpm dev      	— dev-сервер
pnpm build    	— production build
pnpm test     	— unit + smoke тесты
pnpm test:int 	— интеграционные тесты (нужна TEST DB)
pnpm lint     	— ESLint
pnpm typecheck	— tsc --noEmit