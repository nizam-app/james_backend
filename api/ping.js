/**
 * Minimal health check — no Express, no MongoDB.
 * URL: https://YOUR-PROJECT.vercel.app/api/ping
 */
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      ping: true,
      time: new Date().toISOString(),
    })
  );
};
