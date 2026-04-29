import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_URL = 'https://api.paystack.co/transaction/initialize';
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Payment API (Paystack) ---
  app.post('/api/payments/initialize', async (req, res) => {
    try {
      const { email, amount, invoiceId, matterTitle } = req.body;
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      
      if (!secretKey) {
        return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is not configured' });
      }

      const response = await axios.post(PAYSTACK_URL, {
        email,
        amount: amount * 100, // Paystack uses kobo (amount * 100)
        metadata: { invoiceId, matterTitle },
        callback_url: `${process.env.APP_URL}/billing?payment_status=success&invoiceId=${invoiceId}`
      }, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error('Paystack Initialization Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to initialize payment' });
    }
  });

  app.get('/api/payments/verify/:reference', async (req, res) => {
    try {
      const { reference } = req.params;
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      
      if (!secretKey) {
        return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is not configured' });
      }

      const response = await axios.get(`${PAYSTACK_VERIFY_URL}/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error('Paystack Verification Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  // --- OAuth API (Google) ---
  app.get('/api/auth/google/url', (req, res) => {
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

  app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    // Here you would typically exchange the code for a token server-side
    // and store it. For this demo, we'll send a success message to the popup.
    res.send(`
      <html>
        <body>
          <script type='text/javascript' nonce='MGEGuIeaTHl6oC7TNFDwUA==' src='https://aistudio.google.com/L9COLhg8Xxu8B_2PJfX8RpDduMHDpOFcmqbI_6MecgPF_hjW4G7TLl9ljk1i1afTrm2d1IDi3n8snyiAkGYOxtpu_VVyqv-bl4yVRqDFGDv9GnjIh2cwIGDyJwCzKA6g-HSH_tDxmdiwm3CPijLZOw8A6k18tCLlG_cndZoNb0fzBfrF60r-SD6tSUDL6krJPDA3BBDOnEx5mNVEer4OaqtDbrHPumYgdFvCcWzLYLch-Z6_D9JzX2vnHSnjnSOMb3zWeoCKJ6aHp6Wt10BGuS99SAxBg9M-H8x8kulLj4KUeYaFZ7Dmi3Zds5VV4HxYPKt5lVXmCvxsuEBSK0RNKeQ6-oIIcuFcZUEIjVfvB9sfKOV7770sC1O6zNDCo6mpa1Z5WiMk0scF7FgP1lC330JJoRu0aLbMBK1kOFgKjQODLW4WBKh_5QAb4UFnnRgfGeV4PatANuT5KSxVtGajO_CVe8tWo_L_tlCNbG4YjtzQ_hk09nfP1wJTC7z0FuIinU-a3jN4_CtAIA7DLvEXn_j4Q4ip-s47ovUVRHYGUf1NnfmoLcKka96KpC2IcSsqiPUHmAQjH1dORE9lNb7zvl0jfXy1DSnGrw2GPuXYtrpJ8sg6yg'></script><script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_SYNC_SUCCESS', provider: 'google' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Google Sync successful! This window will close.</p>
        </body>
      </html>
    `);
  });

  // --- OAuth API (Microsoft) ---
  app.get('/api/auth/microsoft/url', (req, res) => {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${process.env.APP_URL}/auth/microsoft/callback`);
    
    if (!clientId) return res.status(500).json({ error: 'MICROSOFT_CLIENT_ID not configured' });

    res.json({ url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=https://graph.microsoft.com/Mail.Read` });
  });

  app.get('/auth/microsoft/callback', (req, res) => {
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_SYNC_SUCCESS', provider: 'microsoft' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  });

  // --- Marketing API ---
  app.post('/api/marketing/campaign', (req, res) => {
    const { name, target } = req.body;
    console.log(`Marketing Campaign "${name}" triggered for target: ${target}`);
    res.json({ status: 'queued', message: 'Marketing campaign scheduled successfully' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
