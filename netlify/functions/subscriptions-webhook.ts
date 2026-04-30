import type { Handler } from '@netlify/functions';
import crypto from 'crypto';

export const handler: Handler = async (event) => {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (secret) {
    const hash = crypto.createHmac('sha512', secret).update(event.body || '').digest('hex');
    if (hash !== event.headers['x-paystack-signature']) {
      return { statusCode: 400, body: 'Invalid signature' };
    }
  }

  const webhookEvent = JSON.parse(event.body || '{}');
  console.log('[Paystack Webhook]', webhookEvent.event, webhookEvent.data?.reference || '');
  return { statusCode: 200, body: 'OK' };
};
