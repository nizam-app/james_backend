require('dotenv').config();

const { connectDB } = require('../src/config/db');
const { handleStripeWebhook } = require('../src/controllers/webhook.controller');
const { readRawBody } = require('../src/utils/vercelHttp');

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  try {
    await connectDB();
    const rawBody = await readRawBody(req);
    req.body = rawBody;
    return handleStripeWebhook(req, res);
  } catch (err) {
    console.error('webhook error:', err);
    res.statusCode = 500;
    return res.end('Webhook handler failed');
  }
};
