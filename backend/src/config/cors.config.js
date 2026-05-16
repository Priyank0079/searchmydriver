/**
 * Comma-separated origins in CLIENT_ORIGIN or FRONTEND_URL (e.g. http://localhost:5173,https://app.example.com)
 */
export function getCorsOrigins() {
  const raw = process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
