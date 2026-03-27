# modules/ — Бизнес-логика (чистый TypeScript)
 
ПРАВИЛО: Никакого import from 'next', 'next/server', 'next-auth'.
Сервисы должны работать на любом фреймворке без изменений.
 
Порядок зависимостей (нельзя нарушать):
  auth → user → billing → llm → admin → notifications
 
auth/          — Регистрация, логин, сброс пароля, верификация email.
               Счётчик попыток логина — в Redis.
 
user/          — Профиль, смена пароля, удаление аккаунта.
 
billing/       — Баланс, пополнение, webhook ЮKassa, free-uses.
               КРИТИЧНО: все операции с balance через tx Serializable.
               cleanupStaleReserves() вызывается из instrumentation.ts.
 
llm/           — Запуск инструментов (sync SSE + async pipeline).
               prompt-guard.ts — автоматическая защита от injection.
               cleanupStaleJobs() вызывается из instrumentation.ts.
 
admin/         — Статистика, управление пользователями и инструментами.
 
notifications/ — Обёртка над email-адаптером с бизнес-названиями.

seo/           — SEO-генератор статей. Пайплайн из 9 шагов.
               pipeline.ts — runPipeline, resumePipeline, regeneratePipeline.
               steps/ — каждый шаг возвращает StepResult.
               pricing.ts — calculatePrice (динамическая цена).
               Не импортирует Next.js. Данные между шагами через ctx.data[stepName].
