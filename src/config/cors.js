/** Origins allowed to call the checkout API from the browser */
const DEFAULT_ORIGINS = [
  'https://www.diydryrental.com',
  'https://diydryrental.com',
];

function getAllowedOrigins() {
  const fromEnv = process.env.FRONTEND_ORIGIN;
  const extra = fromEnv
    ? fromEnv.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  return new Set([...DEFAULT_ORIGINS, ...extra]);
}

function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }
  if (getAllowedOrigins().has(origin)) {
    return true;
  }
  if (process.env.NODE_ENV !== 'production') {
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return false;
}

module.exports = { getAllowedOrigins, isOriginAllowed };
