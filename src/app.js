require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const paymentRoutes = require('./routes/payment.routes');
const webhookRoutes = require('./routes/webhook.routes');

const app = express();

const allowedOrigin = process.env.FRONTEND_ORIGIN || 'https://www.diydryrental.com';

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (origin === allowedOrigin || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

// Stripe webhooks require the raw body (must be registered before express.json)
app.use(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

app.use(express.json({ limit: '100kb' }));

// Ensure MongoDB is connected (cached on serverless cold starts)
app.use(async (_req, res, next) => {
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

app.use((err, _req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed' });
  }
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
