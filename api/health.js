require('dotenv').config();

const { applyCors, handleOptions, sendJson } = require('../src/utils/vercelHttp');

module.exports = async (req, res) => {
  applyCors(req, res);
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  return sendJson(res, 200, {
    ok: true,
    service: 'diydry-payment-api',
    mongoConfigured: Boolean(process.env.MONGO_URI),
  });
};
