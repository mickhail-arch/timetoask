# core/ — Фундамент приложения
 
Этот слой не импортирует ничего из других слоёв проекта.
Только Node.js stdlib и npm-пакеты (zod, etc).
 
types/     	— Общие TypeScript типы. Branded strings: UserId, ToolId.
           	ApiResponse<T>, ApiError — формат всех ответов API.
 
errors/    	— Классы ошибок. Все extends AppError.
           	Каждая ошибка знает свой HTTP-статус и code-строку.
           	Использовать везде вместо throw new Error('...')
 
config/env.ts  — Zod-валидация env при старте. Если переменная
           	отсутствует или неверного типа — приложение не запустится.
           	Импортировать: import { env } from '@/core/config/env'
 
constants/ 	— Магические числа. Не хардкодить числа в коде,
           	использовать константы отсюда.