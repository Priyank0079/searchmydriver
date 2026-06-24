const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://searchmydriver.vercel.app',
];

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns the list of browser origins permitted to call this API with
 * credentials. Reads `CLIENT_ORIGIN` (preferred) or `FRONTEND_URL`, both of
 * which accept a comma-separated list, and falls back to the local Vite
 * dev origins when neither is set.
 *
 * Examples:
 *   CLIENT_ORIGIN=https://app.example.com
 *   CLIENT_ORIGIN=https://app.example.com,https://admin.example.com
 */
export function getCorsOrigins() {
  const fromEnv = [
    ...parseList(process.env.CLIENT_ORIGIN),
    ...parseList(process.env.FRONTEND_URL),
  ];
  return fromEnv.length ? Array.from(new Set(fromEnv)) : DEFAULT_DEV_ORIGINS;
}

/**
 * CORS middleware options that work with credentialed (cookie) auth.
 *
 *  • Echoes the matched request `Origin` back in `Access-Control-Allow-Origin`
 *    — browsers reject `*` whenever credentials are sent.
 *  • Allows requests with no `Origin` header (curl, Postman, native mobile,
 *    server-to-server health checks) so they don't trip CORS.
 *  • Surfaces `credentials: true` so the browser actually stores cookies
 *    returned by the API.
 */
export function getCorsOptions() {
  const allowed = new Set(getCorsOrigins());
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.has(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin "${origin}" is not allowed`));
    },
  };
}
