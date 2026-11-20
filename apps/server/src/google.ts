import { OAuth2Client } from 'google-auth-library';
import type { GoogleVerifier } from './app.js';

/** Thiếu GOOGLE_CLIENT_ID → null: API Google trả 503, PIN vẫn chạy. */
export function makeGoogleVerifier(clientId?: string): GoogleVerifier | null {
  if (!clientId) return null;
  const client = new OAuth2Client(clientId);
  return async (idToken) => {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const p = ticket.getPayload();
    if (!p?.sub) throw new Error('invalid token');
    return p.name ? { sub: p.sub, name: p.name } : { sub: p.sub };
  };
}
