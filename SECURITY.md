# Security Guide (IMPORTANT)

This project places **Binance Spot LIMIT orders**.
If you misconfigure your API key or expose your local server, you can lose funds.

## Non‑negotiable Rules

1) **Never put API keys in the frontend**
- Do **NOT** store keys in React code, browser storage, or client-side `.env`.
- The browser must never see your `BINANCE_SECRET_KEY`.

2) **Never commit keys to GitHub**
- Keep `.env` and any secrets files ignored.
- If you accidentally pushed a key: **revoke it immediately** in Binance.

3) **Enable IP whitelist on Binance API keys (strongly recommended)**
- Restrict the key to the machine running OpenClaw / the local order server.
- This is the best protection if the key leaks.

4) **Minimum permissions**
- Enable only what you need:
  - ✅ Read (optional)
  - ✅ Spot trading
  - ❌ Withdrawals (must stay OFF)
  - ❌ Futures / Margin unless you explicitly need them

5) **Local server must NOT be exposed publicly**
- The included order server is intended for `localhost` usage.
- Do not port-forward it. Do not deploy it to a public VPS.

## Recommended Setup

- Store credentials as **OS environment variables**:
  - `BINANCE_API_KEY`
  - `BINANCE_SECRET_KEY`

- Run the order server locally:
  - `npm run server`

- The React UI calls the local server only via:
  - `GET /api/status`
  - `POST /api/orders`

## Safe Operating Practices

- Use a dedicated Binance API key for this tool.
- Set a conservative maximum order size in your strategy.
- Keep your machine clean:
  - OS updates
  - disable unknown browser extensions
  - avoid running random scripts

## If Something Goes Wrong

- Revoke the key in Binance immediately.
- Check open orders and cancel if needed.
- Rotate credentials.
