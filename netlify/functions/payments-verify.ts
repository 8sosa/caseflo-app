import type { Handler } from '@netlify/functions';
import axios from 'axios';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { reference } = JSON.parse(event.body || '{}');
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { statusCode: 500, body: JSON.stringify({ error: 'PAYSTACK_SECRET_KEY not configured' }) };

  try {
    const res = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    return { statusCode: 200, body: JSON.stringify(res.data) };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to verify payment' }) };
  }
};
