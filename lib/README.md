# lib/ — Синглтоны и утилиты уровня приложения
 
Файлы в этой папке инициализируются один раз и
используются во всём приложении через импорт.
 
prisma.ts  	— ЕДИНСТВЕННОЕ место создания PrismaClient.
             	new PrismaClient() ЗАПРЕЩЁН везде кроме этого файла.
             	Используй: import { prisma } from '@/lib/prisma'
 
redis.ts   	— Singleton ioredis-клиент.
             	Используй: import { redis } from '@/lib/redis'
 
auth.ts    	— NextAuth authOptions. Credentials Provider.
             	Используй: import { authOptions } from '@/lib/auth'
 
concurrency.ts — Атомарные слоты через Redis Lua-скрипт.
             	acquireSlot(userId) / releaseSlot(userId)
             	Счётчики ТОЛЬКО здесь, никаких in-memory переменных.
