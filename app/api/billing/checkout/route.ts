//app/api/billing/checkout/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-helpers';
import { readJson } from '@/lib/read-json';
import { rateLimit } from '@/lib/rate-limit';
import { createCheckout } from '@/modules/billing';

const schema = z.object({
  amount: z.number().int().min(100).max(100000),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { amount } = schema.parse(await readJson(req));
    const userId = session.user.id;

    const allowed = await rateLimit(`checkout:${userId}`, 10, 3600);
    if (!allowed) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests', statusCode: 429 } },
        { status: 429 },
      );
    }

    const result = await createCheckout(userId, amount);
    return NextResponse.json({ data: { paymentId: result.paymentId, confirmationUrl: result.confirmationUrl } });
  } catch (e) {
    return apiError(e, 'POST /api/billing/checkout');
  }
}
