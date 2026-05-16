export const COOKIE_NAMES = Object.freeze({
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
});

const ACCESS_MAX_MS = 15 * 60 * 1000;
const REFRESH_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export function getBaseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  };
}

/**
 * Sets httpOnly auth cookies. Tokens are never returned in JSON.
 * @param {import('express').Response} res
 * @param {{ accessToken: string; refreshToken: string }} tokens
 */
export function setAuthCookies(res, { accessToken, refreshToken }) {
  const base = getBaseCookieOptions();
  res.cookie(COOKIE_NAMES.accessToken, accessToken, { ...base, maxAge: ACCESS_MAX_MS });
  res.cookie(COOKIE_NAMES.refreshToken, refreshToken, { ...base, maxAge: REFRESH_MAX_MS });
}

/**
 * @param {import('express').Response} res
 */
export function clearAuthCookies(res) {
  const base = getBaseCookieOptions();
  res.clearCookie(COOKIE_NAMES.accessToken, base);
  res.clearCookie(COOKIE_NAMES.refreshToken, base);
}
