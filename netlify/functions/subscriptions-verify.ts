import type { Handler } from '@netlify/functions';
import axios from 'axios';

const PLAN_CONFIG = {
  starter:      { price: 15000, maxUsers: 3   },
  professional: { price: 35000, maxUsers: 15  },
  enterprise:   { price: 75000, maxUsers: 999 },
} as const;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { reference } = JSON.parse(event.body || '{}');
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { statusCode: 500, body: JSON.stringify({ error: 'PAYSTACK_SECRET_KEY not configured' }) };

  try {
    const res = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });

    const tx = res.data?.data;
    if (tx?.status !== 'success') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Payment not successful', status: tx?.status }) };
    }

    const { orgId, plan, maxUsers } = tx.metadata || {};
    const planCfg = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
    const subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      statusCode: 200,
      body: JSON.stringify({
        verified: true,
        orgId,
        plan,
        maxUsers: maxUsers || planCfg?.maxUsers,
        amount: tx.amount / 100,
        subscriptionExpiresAt,
        paystackReference: reference
      })
    };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to verify subscription' }) };
  }
};
