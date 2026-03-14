// app/api/tools/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unauthorized, apiError } from '@/lib/api-helpers';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  try {
    const tools = await prisma.tool.findMany({ where: { status: 'enabled' } });
    return NextResponse.json({ data: tools });
  } catch (e) { return apiError(e, 'GET /api/tools'); }
}
