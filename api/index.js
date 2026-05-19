/**
 * Vercel serverless entry for Express.
 */
const serverless = require('serverless-http');

let handler;

function getHandler() {
  if (!handler) {
    const app = require('../src/app');
    handler = serverless(app, {
      binary: false,
      request(req, _event, context) {
        context.callbackWaitsForEmptyEventLoop = false;
      },
    });
  }
  return handler;
}

module.exports = async (req, res) => {
  try {
    return await getHandler()(req, res);
  } catch (err) {
    console.error('API boot error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        message: 'API failed to start',
        error: err.message,
      })
    );
  }
};
