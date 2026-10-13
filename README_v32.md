# BALANCE v32 — Telegram Identity Foundation

**Source:** exact visual assets, CSS, and animation markup from approved v31.6. Only `index.html` (Telegram SDK script) and `scripts/app-v29.mjs` (data loading) were modified. New `server/server.py` implements Telegram-authenticated API and SQLite persistence.

## Local Mac testing (new API + database)

From this folder in Terminal:

```bash
BALANCE_DEV_MODE=1 python3 server/server.py
```

Open http://localhost:8005. The backend stores preview letters under a dedicated `dev:local-preview` user. Existing `python3 -m http.server` also works as a **local-only fallback** but does not test server persistence.

## Telegram deployment

Run the server with `TELEGRAM_BOT_TOKEN` set securely in the host's environment, and with `BALANCE_DB_PATH` pointing to **persistent storage**. Expose it behind HTTPS on the same origin as the frontend. Never put the bot token in frontend code or a public GitHub repository. Set the bot's Mini App URL to that HTTPS domain. Do not enable `BALANCE_DEV_MODE` in production.

The `/api/daily-letters` endpoint verifies Telegram WebApp `initData` HMAC, validates `auth_date` (24-hour window), derives the verified Telegram user ID, and stores three letter snapshots for the current Kyiv day in SQLite with a unique `(user_id, day_key, category)` constraint. It never trusts an arbitrary user ID supplied by the client.

**Security caveat:** This foundation requires deployment hardening before launch: HTTPS reverse proxy, backups, rate limiting, logging policy, and a production-capable hosting process. Local browser fallback is for previews only; cross-device behavior requires the API.

**Day behavior:** New assignments are generated on the next API request after 00:00 Kyiv; no midnight background job is required. Already-issued messages are snapshots and survive library changes. Current cycling prevents repeats on adjacent days *when the library is unchanged*; editing library order may affect future choices.

**Privacy:** Database stores Telegram numeric ID, Kyiv date, category, and message text. It does not store name, username, or chat content. Set a data retention/deletion policy before public release.
