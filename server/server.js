// Minimal local backend for order placement.
// Security: reads BINANCE_API_KEY / BINANCE_SECRET_KEY from environment.
// DO NOT expose this server publicly.

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));

const BASE_URL = process.env.BINANCE_BASE_URL || 'https://api.binance.com';

function isConfigured() {
  return Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY);
}

function sign(queryString) {
  return crypto.createHmac('sha256', process.env.BINANCE_SECRET_KEY).update(queryString).digest('hex');
}

async function binanceRequest(method, path, params = {}) {
  if (!isConfigured()) {
    throw new Error('BINANCE_API_KEY / BINANCE_SECRET_KEY not set');
  }

  const timestamp = Date.now();
  const recvWindow = 5000;

  const search = new URLSearchParams({ ...params, timestamp: String(timestamp), recvWindow: String(recvWindow) });
  const signature = sign(search.toString());
  search.append('signature', signature);

  const url = `${BASE_URL}${path}?${search.toString()}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-MBX-APIKEY': process.env.BINANCE_API_KEY,
      'User-Agent': 'binance-spot/1.0.1 (Skill-like-server)',
    },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data && data.msg ? data.msg : res.statusText;
    const err = new Error(`Binance error ${res.status}: ${msg}`);
    err.data = data;
    throw err;
  }

  return data;
}

app.get('/api/status', async (req, res) => {
  res.json({
    configured: isConfigured(),
    baseUrl: BASE_URL,
  });
});

// Place multiple LIMIT orders
app.post('/api/orders', async (req, res) => {
  const { symbol, side, orders } = req.body || {};
  if (!symbol || !side || !Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: 'Missing symbol/side/orders' });
  }

  try {
    const results = [];
    for (const o of orders) {
      const price = Number(o.price);
      const quantity = Number(o.quantity);
      if (!price || !quantity) {
        throw new Error('Each order requires price and quantity');
      }

      const data = await binanceRequest('POST', '/api/v3/order', {
        symbol,
        side,
        type: 'LIMIT',
        timeInForce: 'GTC',
        price: price.toFixed(2),
        quantity: quantity.toFixed(6),
        newOrderRespType: 'RESULT',
      });
      results.push(data);
    }

    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, details: e.data || null });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
