//app/api/billing/webhook/route.ts
import { NextResponse } from 'next/server';
import { handleWebhook } from '@/modules/billing';
import { ValidationError } from '@/core/errors';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    await handleWebhook(body);
    return NextResponse.json({ data: { received: true } });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message, statusCode: 400 } },
        { status: 400 },
      );
    }
    console.error('[POST /api/billing/webhook]', e);
    return NextResponse.json({ data: { received: false } });
  }
}
