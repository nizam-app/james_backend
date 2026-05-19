require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const { isOriginAllowed } = require('./config/cors');
const paymentRoutes = require('./routes/payment.routes');
const webhookRoutes = require('./routes/webhook.routes');

const app = express();

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

/** CORS first — required for diydryrental.com → Vercel API (incl. OPTIONS preflight) */
function corsMiddleware(req, res, next) {
  applyCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
}

async function requireDb(req, res, next) {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    applyCorsHeaders(req, res);
    res.status(503).json({
      message:
        'Database unavailable. Check MONGO_URI on Vercel (use MongoDB Atlas, not localhost).',
    });
  }
}

app.use(corsMiddleware);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '100kb' }));

/** Fast health check — does NOT wait for MongoDB (avoids browser timeout) */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'diydry-payment-api',
    mongoConfigured: Boolean(process.env.MONGO_URI),
  });
});

/** Optional: verify MongoDB from Atlas / Vercel */
app.get('/api/health/db', requireDb, (_req, res) => {
  res.json({ ok: true, database: 'connected' });
});

// Stripe webhooks require the raw body
app.use(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  requireDb,
  webhookRoutes
);

app.use('/api', requireDb, paymentRoutes);

app.use((err, req, res, _next) => {
  applyCorsHeaders(req, res);
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
