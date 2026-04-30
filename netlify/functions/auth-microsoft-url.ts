import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const appUrl = process.env.APP_URL;
  if (!clientId) return { statusCode: 500, body: JSON.stringify({ error: 'MICROSOFT_CLIENT_ID not configured' }) };

  const redirectUri = encodeURIComponent(`${appUrl}/auth/microsoft/callback`);
  const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=https://graph.microsoft.com/Mail.Read`;

  return { statusCode: 200, body: JSON.stringify({ url }) };
};
