require('dotenv').config();

const { connectDB } = require('../../src/config/db');
const { applyCors, handleOptions, sendJson } = require('../../src/utils/vercelHttp');

module.exports = async (req, res) => {
  applyCors(req, res);
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  try {
    await connectDB();
    return sendJson(res, 200, { ok: true, database: 'connected' });
  } catch (err) {
    return sendJson(res, 503, {
      message:
        'Database unavailable. Set MONGO_URI on Vercel to MongoDB Atlas (not localhost).',
      error: err.message,
    });
  }
};
