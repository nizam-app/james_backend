/**
 * Vercel serverless: POST /api/create-payment-intent
 * Standalone function (does not use Express rewrite — avoids timeouts).
 */
require('dotenv').config();

const { connectDB } = require('../src/config/db');
const { createPaymentIntentFromBody } = require('../src/services/payment.service');
const {
  applyCors,
  handleOptions,
  readJsonBody,
  sendJson,
} = require('../src/utils/vercelHttp');

module.exports = async (req, res) => {
  applyCors(req, res);
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  try {
    await connectDB();
    const body = await readJsonBody(req);
    const result = await createPaymentIntentFromBody(body);
    return sendJson(res, result.status, result.data);
  } catch (err) {
    console.error('create-payment-intent error:', err);
    const status = err.message === 'Invalid JSON body' ? 400 : 500;
    return sendJson(res, status, {
      message: err.message || 'Internal server error',
    });
  }
};
