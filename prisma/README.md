# prisma/ — Схема базы данных
 
schema.prisma  — 12 таблиц
migrations/	— автогенерация через prisma migrate dev
seed.ts    	— начальные данные (admin-пользователь, дефолтные tools)
seed-cleanup.ts — удаление инструментов из БД
 
Команды:
  pnpm prisma migrate dev   	— создать миграцию
  pnpm prisma migrate reset 	— ОСТОРОЖНО: сбросит БД
  pnpm prisma db seed       	— заполнить начальными данными
  pnpm prisma studio        	— GUI для БД
 
ВАЖНО: migrate reset --force только для wrapper_test !
Перед запуском проверить DATABASE_URL содержит 'test'.
 
Driver adapter: @prisma/adapter-pg обязателен (Prisma 7).
Генерация: output = generated/prisma (не node_modules).