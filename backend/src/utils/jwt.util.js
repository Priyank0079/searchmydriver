import jwt from 'jsonwebtoken';
import { ApiError } from './apiError.js';
import { ACCOUNT_DRIVER, ACCOUNT_USER } from '../constants/roles.js';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new ApiError(500, `${name} is not configured`);
  return v;
}

/**
 * @param {import('mongoose').Document & { role?: string }} user — User model
 */
export function tokenPayloadFromUser(user) {
  return {
    id: user._id.toString(),
    role: user.role,
    accountType: ACCOUNT_USER,
  };
}

/**
 * @param {import('mongoose').Document} driver — Driver model (no role field; always driver)
 */
export function tokenPayloadFromDriver(driver) {
  return {
    id: driver._id.toString(),
    role: 'driver',
    accountType: ACCOUNT_DRIVER,
  };
}

/**
 * @param {{ id: string; role: string; accountType: string }} payload
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, requireEnv('ACCESS_TOKEN_SECRET'), {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    algorithm: 'HS256',
  });
}

/**
 * @param {{ id: string; role: string; accountType: string }} payload
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, requireEnv('REFRESH_TOKEN_SECRET'), {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  });
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, requireEnv('REFRESH_TOKEN_SECRET'));
  } catch {
    throw new ApiError(401, 'Refresh token expired or invalid. Please sign in again.');
  }
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, requireEnv('ACCESS_TOKEN_SECRET'));
  } catch {
    throw new ApiError(401, 'Access token expired or invalid');
  }
}

/**
 * Back-compat for tokens issued before accountType existed.
 * @param {object} decoded
 */
export function inferAccountType(decoded) {
  if (decoded.accountType === ACCOUNT_USER || decoded.accountType === ACCOUNT_DRIVER) {
    return decoded.accountType;
  }
  if (decoded.role === 'driver') return ACCOUNT_DRIVER;
  return ACCOUNT_USER;
}
