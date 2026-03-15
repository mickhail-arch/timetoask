# workers/ — Фоновые задачи
 
jobs/tool-execution.job.ts — воркер async-инструментов.
 
MVP: выполняется в процессе Next.js (без BullMQ/Redis Queue).
При нагрузке >100 DAU вынести в отдельный Node.js процесс.
 
Воркер всегда освобождает Redis-слоты в finally блоке.
Зависшие задачи очищает cleanupStaleJobs() из instrumentation.ts.
 
Статусы job_steps: pending → processing → completed | failed
Клиент получает статус через GET /api/jobs/:jobId/status
