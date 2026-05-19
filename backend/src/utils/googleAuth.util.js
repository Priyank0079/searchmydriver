import { OAuth2Client } from 'google-auth-library';
import { ApiError } from './apiError.js';

let client;

function getGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new ApiError(500, 'Google sign-in is not configured');
  }
  if (!client) {
    client = new OAuth2Client(clientId);
  }
  return client;
}

/**
 * Verify Google ID token from the client (GIS / GSI).
 * @param {string} credential
 * @returns {Promise<{ googleId: string, email: string, name: string, picture: string, emailVerified: boolean }>}
 */
export async function verifyGoogleIdToken(credential) {
  if (!credential || typeof credential !== 'string') {
    throw new ApiError(400, 'Google credential is required');
  }

  try {
    const ticket = await getGoogleClient().verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new ApiError(401, 'Invalid Google token');
    }

    if (!payload.email) {
      throw new ApiError(400, 'Google account must have an email address');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || '',
      emailVerified: Boolean(payload.email_verified),
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'Google sign-in failed. Please try again.');
  }
}
