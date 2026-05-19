require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const { isOriginAllowed } = require('./config/cors');
const paymentRoutes = require('./routes/payment.routes');
const webhookRoutes = require('./routes/webhook.routes');

const app = express();

/** CORS first — required for diydryrental.com → Vercel API (incl. OPTIONS preflight) */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
}

app.use(corsMiddleware);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Stripe webhooks require the raw body (must be registered before express.json)
app.use(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

app.use(express.json({ limit: '100kb' }));

app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    res.status(503).json({ message: 'Database unavailable' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'diydry-payment-api' });
});

app.use('/api', paymentRoutes);

app.use((err, req, res, _next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
