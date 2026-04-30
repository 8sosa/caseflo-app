import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_URL = `${PAYSTACK_BASE}/transaction/initialize`;
const PAYSTACK_VERIFY_URL = `${PAYSTACK_BASE}/transaction/verify`;

const PLAN_CONFIG = {
  starter:      { name: 'Starter',      price: 15000, maxUsers: 5  },
  professional: { name: 'Professional', price: 35000, maxUsers: 15 },
  enterprise:   { name: 'Enterprise',   price: 75000, maxUsers: 999 },
} as const;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ── Invoice Payments ────────────────────────────────────────────────────────

  app.post('/api/payments/initialize', async (req, res) => {
    try {
      const { email, amount, invoiceId, matterTitle } = req.body;
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is not configured' });

      const response = await axios.post(PAYSTACK_URL, {
        email,
        amount: amount * 100,
        metadata: { invoiceId, matterTitle },
        callback_url: `${process.env.APP_URL}/billing?payment_status=success&invoiceId=${invoiceId}`
      }, { headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' } });

      res.json(response.data);
    } catch (error: any) {
      console.error('Paystack Invoice Init Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to initialize payment' });
    }
  });

  // POST (used by frontend) and GET (backward compat) both supported
  const verifyPayment = async (reference: string, res: any) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is not configured' });
    try {
      const response = await axios.get(`${PAYSTACK_VERIFY_URL}/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` }
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  };

  app.post('/api/payments/verify', async (req, res) => {
    await verifyPayment(req.body.reference, res);
  });

  app.get('/api/payments/verify/:reference', async (req, res) => {
    await verifyPayment(req.params.reference, res);
  });

  // ── Subscription Payments ───────────────────────────────────────────────────

  app.post('/api/subscriptions/initialize', async (req, res) => {
    try {
      const { email, plan, orgId, orgName } = req.body;
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is not configured' });

      const planCfg = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
      if (!planCfg) return res.status(400).json({ error: 'Invalid plan' });

      const subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await axios.post(PAYSTACK_URL, {
        email,
        amount: planCfg.price * 100,
        currency: 'NGN',
        metadata: {
          orgId,
          orgName,
          plan,
          maxUsers: planCfg.maxUsers,
          subscriptionExpiresAt,
          custom_fields: [
            { display_name: 'Organization', variable_name: 'org_name', value: orgName },
            { display_name: 'Plan',         variable_name: 'plan',     value: planCfg.name }
          ]
        },
        callback_url: `${process.env.APP_URL}?sub_status=success&orgId=${orgId}&plan=${plan}`
      }, { headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' } });

      res.json(response.data);
    } catch (error: any) {
      console.error('Subscription Init Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to initialize subscription' });
    }
  });

  app.post('/api/subscriptions/verify', async (req, res) => {
    try {
      const { reference } = req.body;
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is not configured' });

      const response = await axios.get(`${PAYSTACK_VERIFY_URL}/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` }
      });

      const txData = response.data?.data;
      if (txData?.status !== 'success') {
        return res.status(400).json({ error: 'Payment not successful', status: txData?.status });
      }

      const { orgId, plan, maxUsers } = txData.metadata || {};
      const planCfg = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
      const subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      res.json({
        verified: true,
        orgId,
        plan,
        maxUsers: maxUsers || planCfg?.maxUsers,
        amount: txData.amount / 100,
        subscriptionExpiresAt,
        paystackReference: reference
      });
    } catch (error: any) {
      console.error('Subscription Verify Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to verify subscription' });
    }
  });

  // Paystack webhook – handles recurring charge events
  app.post('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    if (secret) {
      const hash = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
      if (hash !== req.headers['x-paystack-signature']) {
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const event = JSON.parse(req.body.toString());
    console.log('[Paystack Webhook]', event.event, event.data?.reference || '');

    // Log event for audit; actual Firestore update happens client-side on next login
    // To enable server-side Firestore updates, add FIREBASE_SERVICE_ACCOUNT_KEY env var
    // and integrate firebase-admin SDK here.

    res.sendStatus(200);
  });

  // ── OAuth ───────────────────────────────────────────────────────────────────

  app.get('/api/auth/google/url', (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.APP_URL}/auth/google/callback`;
    if (!clientId) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent'
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  });

  app.get('/auth/google/callback', async (_req, res) => {
    res.send(`<html><body><script>
      if(window.opener){window.opener.postMessage({type:'OAUTH_SYNC_SUCCESS',provider:'google'},'*');window.close();}
      else{window.location.href='/';}
    </script><p>Google Sync successful!</p></body></html>`);
  });

  app.get('/api/auth/microsoft/url', (_req, res) => {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${process.env.APP_URL}/auth/microsoft/callback`);
    if (!clientId) return res.status(500).json({ error: 'MICROSOFT_CLIENT_ID not configured' });
    res.json({ url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=https://graph.microsoft.com/Mail.Read` });
  });

  app.get('/auth/microsoft/callback', (_req, res) => {
    res.send(`<html><body><script>
      if(window.opener){window.opener.postMessage({type:'OAUTH_SYNC_SUCCESS',provider:'microsoft'},'*');window.close();}
      else{window.location.href='/';}
    </script></body></html>`);
  });

  // ── Marketing ───────────────────────────────────────────────────────────────

  app.post('/api/marketing/campaign', (req, res) => {
    const { name, target } = req.body;
    console.log(`Marketing Campaign "${name}" triggered for target: ${target}`);
    res.json({ status: 'queued', message: 'Marketing campaign scheduled successfully' });
  });

  // ── Vite / Static ───────────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
