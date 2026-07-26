// /api/garden.js
//
// Shared, persistent storage for the garden (songs + affirmations).
// Works with Vercel's "Redis" storage integration or the Upstash
// marketplace integration — whichever env var names Vercel assigned
// when you connected it, this picks them up automatically.
//
// No npm install needed — uses Upstash's plain REST API.

const REST_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_URL;

const REST_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_TOKEN;

const KEY = 'xeiaGarden';

async function redis(command) {
  if (!REST_URL || !REST_TOKEN) {
    throw new Error(
      'missing-env: no Redis REST URL/token found. Connect a Redis/Upstash database to this project in the Vercel dashboard (Storage tab), then redeploy.'
    );
  }
  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}` },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`redis-error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.result;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', KEY]);
      const garden = raw ? JSON.parse(raw) : [];
      res.status(200).json({ garden });
      return;
    }

    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      const garden = Array.isArray(body?.garden) ? body.garden : [];
      if (garden.length > 3000) {
        res.status(400).json({ error: 'too-many-items' });
        return;
      }
      await redis(['SET', KEY, JSON.stringify(garden)]);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'method-not-allowed' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown-error';
    const isConfigIssue = msg.startsWith('missing-env');
    res.status(isConfigIssue ? 500 : 502).json({ error: msg });
  }
};
