# plugins/ — Инструменты (AI-powered)
 
Каждый инструмент = папка с ровно 7 файлами.
Добавить инструмент = создать папку. Менять registry.ts не нужно.
 
_template/     — Эталон. Копировать при создании нового инструмента.
registry.ts    — Реестр. initialize() ТОЛЬКО в instrumentation.ts.
               resolve(id): файлы → БД → merge. БД всегда побеждает.
 
Правила для каждого инструмента:
  manifest.json  — status: 'disabled' до ручного включения в админке
  schema.ts      — каждое поле обязательно с .describe() (label в форме)
  handler.ts     — ТОЛЬКО строковые операции, никакого API
  prompt.ts      — не упоминать guard (добавляется автоматически)
 
executionMode:
  sync  — SSE-стрим, ответ < 30 сек
  async — jobId + polling /api/jobs/:id/status
 
После включения инструмента в админке:
  ToolRegistry.invalidateCache(toolId) вызывается автоматически
