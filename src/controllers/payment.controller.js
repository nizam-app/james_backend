const { createPaymentIntentFromBody } = require('../services/payment.service');

async function createPaymentIntent(req, res) {
  const result = await createPaymentIntentFromBody(req.body);
  return res.status(result.status).json(result.data);
}

module.exports = { createPaymentIntent };
