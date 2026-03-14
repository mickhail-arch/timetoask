# plugins/_template/ — Шаблон инструмента
 
Это эталонный пустой инструмент. Не модифицировать.
При создании нового инструмента: скопировать папку, переименовать.
 
Файлы:
  manifest.json  — ВСЕГДА status: disabled в шаблоне
  schema.ts      — заменить поля на реальные с .describe()
  prompt.ts      — написать системный промпт инструмента
  handler.ts     — реализовать buildUserMessage(input): string
  index.ts       — не менять (ITool интерфейс)
  example.json   — заполнить реальным примером до PR
  smoke.test.ts  — проверить schema + buildUserMessage без API
