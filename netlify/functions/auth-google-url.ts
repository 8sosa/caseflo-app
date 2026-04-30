import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL;
  if (!clientId) return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_CLIENT_ID not configured' }) };

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/auth/google/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent'
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
  };
};
