// Local backend for order placement via OpenClaw's Binance Spot skill.
//
// Why: We do NOT want to re-implement signing logic or handle raw keys in the UI.
// This server delegates order placement to OpenClaw (tool/skill call) so that
// API keys can be managed by OpenClaw in a safer, centralized way.
//
// IMPORTANT SECURITY:
// - Keep this server local (localhost only). Do NOT expose to the internet.
// - Do NOT log API secrets.

const express = require('express');
const { spawnSync } = require('child_process');

const app = express();
app.use(express.json({ limit: '1mb' }));

function runOpenClawAgent(messageObj) {
  // We use the Gateway-routed agent (NOT --local) so the tool call happens inside OpenClaw.
  // Output JSON for parsing.
  const message = JSON.stringify(messageObj);

  const cmd = 'openclaw';
  const args = ['agent', '--message', message, '--json'];

  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`openclaw agent failed (${r.status}): ${r.stderr || r.stdout}`);
  }

  // openclaw agent --json returns JSON (string)
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    // If parsing fails, include raw output
    out = { raw: r.stdout };
  }

  return out;
}

app.get('/api/status', async (req, res) => {
  // Best-effort status.
  // Real validation is performed when placing an authenticated order.
  res.json({
    configured: true,
    note: 'This server delegates to OpenClaw spot skill. Ensure OpenClaw gateway is running and spot skill is configured.',
  });
});

// Place multiple LIMIT orders (delegated to spot skill)
app.post('/api/orders', async (req, res) => {
  const { symbol, side, orders } = req.body || {};
  if (!symbol || !side || !Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ ok: false, error: 'Missing symbol/side/orders' });
  }

  if (side !== 'BUY' && side !== 'SELL') {
    return res.status(400).json({ ok: false, error: 'side must be BUY or SELL' });
  }

  // Validate payload
  for (const o of orders) {
    const price = Number(o.price);
    const quantity = Number(o.quantity);
    if (!price || !quantity || price <= 0 || quantity <= 0) {
      return res.status(400).json({ ok: false, error: 'Each order requires positive price and quantity' });
    }
  }

  try {
    // We instruct the agent to call the official spot skill.
    // The agent will place LIMIT orders via /api/v3/order.
    const agentTask = {
      kind: 'spot_limit_batch',
      symbol,
      side,
      orders: orders.map((o) => ({ price: Number(o.price), quantity: Number(o.quantity) })),
      instruction:
        'Use Binance official spot skill to place LIMIT orders on Binance. Place one order per item. Return JSON array of results including orderId/status. Do NOT print secrets.',
    };

    const out = runOpenClawAgent(agentTask);

    res.json({ ok: true, openclaw: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, '127.0.0.1', () => {
  console.log(`[server] listening on http://127.0.0.1:${port}`);
});
