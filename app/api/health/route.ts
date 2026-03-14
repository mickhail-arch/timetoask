import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { NextResponse } from 'next/server'

export async function GET() {
  const checks = { db: false, redis: false }

  try { await prisma.$queryRaw`SELECT 1`; checks.db = true } catch {}
  try { await redis.ping(); checks.redis = true } catch {}

  const ok = checks.db && checks.redis
  return NextResponse.json(
    { data: { status: ok ? 'ok' : 'degraded', checks } },
    { status: ok ? 200 : 503 }
  )
}
