/**
 * Vercel serverless entry — exports the Express app (no app.listen).
 * @see https://vercel.com/docs/frameworks/backend/express
 */
const app = require('../src/app');

module.exports = app;
