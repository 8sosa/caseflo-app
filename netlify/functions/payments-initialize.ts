import type { Handler } from '@netlify/functions';
import axios from 'axios';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { email, amount, invoiceId, matterTitle } = JSON.parse(event.body || '{}');
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { statusCode: 500, body: JSON.stringify({ error: 'PAYSTACK_SECRET_KEY not configured' }) };

  try {
    const res = await axios.post('https://api.paystack.co/transaction/initialize', {
      email,
      amount: amount * 100,
      metadata: { invoiceId, matterTitle },
      callback_url: `${process.env.APP_URL}/billing?payment_status=success&invoiceId=${invoiceId}`
    }, { headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' } });

    return { statusCode: 200, body: JSON.stringify(res.data) };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.response?.data?.message || 'Failed to initialize payment' }) };
  }
};
