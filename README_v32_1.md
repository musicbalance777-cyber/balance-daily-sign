# BALANCE v32.1 — Netlify + Supabase integration

**Visual baseline:** copied from approved v31.6, including animation, CSS, imagery, and `home-v17` assets. No visual or animation files changed.

## Deployment
1. Create a Supabase project and run `supabase_schema.sql` in its SQL Editor.
2. In Netlify → Site configuration → Environment variables, set `TELEGRAM_BOT_TOKEN` (BotFather token), `SUPABASE_URL` (project URL), and `SUPABASE_SERVICE_ROLE_KEY` (secret server key). Do not add these values to Git or frontend code.
3. Deploy this folder/repository on Netlify. Build command: leave empty; publish directory: `.`; functions directory: `netlify/functions` (configured by `netlify.toml`). Netlify's Functions runtime must support modern Node.js with JSON import attributes (Node 22+ recommended).
4. In Telegram BotFather, set the Mini App URL to your actual `https://...netlify.app` (or custom domain) URL. If already configured, change only if URL differs.
5. Test in Telegram. Open each category, reopen the same category, close/reopen the Mini App; verify unchanged text. Check Supabase table for three records for your Telegram user ID and Kyiv date. Repeat from another device signed into the same Telegram account.

## Behavior and boundaries
- `POST /api/daily-letters` routes to a Netlify Function, validates Telegram signed initData (HMAC, 24h age), and stores a text snapshot for each category with a unique user/date/category key.
- The server assigns a new set on first request after Kyiv midnight. No scheduled job needed.
- When opened in Telegram, the frontend **never silently falls back** to browser-local identity if the API fails.
- Static/local Mac preview remains possible, using existing browser-only fallback. The old `server/server.py` remains for independent local testing; it is **not** deployed as a Netlify Function.
- Database persistence, real Telegram auth, cross-device sync, and hosting have **not been verified live** in this package. Test before public launch.
- For production, configure backups, rate limits, monitoring, data retention and deletion policy.
