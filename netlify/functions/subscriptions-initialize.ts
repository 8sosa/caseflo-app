import type { Handler } from '@netlify/functions';
import axios from 'axios';

const PLAN_CONFIG = {
  starter:      { name: 'Starter',      price: 15000, maxUsers: 5   },
  professional: { name: 'Professional', price: 35000, maxUsers: 15  },
  enterprise:   { name: 'Enterprise',   price: 75000, maxUsers: 999 },
} as const;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { email, plan, orgId, orgName } = JSON.parse(event.body || '{}');
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { statusCode: 500, body: JSON.stringify({ error: 'PAYSTACK_SECRET_KEY not configured' }) };

  const planCfg = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
  if (!planCfg) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid plan' }) };

  try {
    const res = await axios.post('https://api.paystack.co/transaction/initialize', {
      email,
      amount: planCfg.price * 100,
      currency: 'NGN',
      metadata: {
        orgId, orgName, plan,
        maxUsers: planCfg.maxUsers,
        custom_fields: [
          { display_name: 'Organization', variable_name: 'org_name', value: orgName },
          { display_name: 'Plan', variable_name: 'plan', value: planCfg.name }
        ]
      },
      callback_url: `${process.env.APP_URL}?sub_status=success&orgId=${orgId}&plan=${plan}`
    }, { headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' } });

    return { statusCode: 200, body: JSON.stringify(res.data) };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to initialize subscription' }) };
  }
};
