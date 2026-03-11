// adapters/payments/yokassa.adapter.ts — YoKassa payments adapter
import crypto from 'node:crypto';
import { env } from '@/core/config/env';
import { InternalError } from '@/core/errors';

const YOKASSA_API = 'https://api.yookassa.ru/v3/payments';

export type PaymentResponse = {
  paymentId: string;
  status: string;
  confirmationUrl: string;
};

export async function createPayment(
  amount: number,
  idempotencyKey: string,
): Promise<PaymentResponse> {
  const credentials = Buffer.from(
    `${env.YOKASSA_SHOP_ID}:${env.YOKASSA_SECRET_KEY}`,
  ).toString('base64');

  const res = await fetch(YOKASSA_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: env.YOKASSA_RETURN_URL },
      capture: true,
    }),
  });

  if (!res.ok) {
    console.error(`[yokassa] createPayment failed status=${res.status}`);
    throw new InternalError('YoKassa payment creation failed');
  }

  const data = await res.json();

  console.info(`[yokassa] createPayment ok paymentId=${data.id}`);

  return {
    paymentId: data.id,
    status: data.status,
    confirmationUrl: data.confirmation.confirmation_url,
  };
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
): boolean {
  const computed = crypto
    .createHmac('sha256', env.YOKASSA_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature, 'hex');
  const computedBuffer = Buffer.from(computed, 'hex');

  if (signatureBuffer.length !== computedBuffer.length) {
    console.warn(`[yokassa] webhook signature mismatch hash=${computed}`);
    return false;
  }

  const valid = crypto.timingSafeEqual(signatureBuffer, computedBuffer);

  if (!valid) {
    console.warn(`[yokassa] webhook signature mismatch hash=${computed}`);
  }

  return valid;
}
