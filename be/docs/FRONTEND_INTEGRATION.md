# Frontend integration

This API gates sign-in with a **Telegram approval** step. After you prove identity (demo password or Google), the user waits until an admin approves in Telegram; your app polls until `approved` or `rejected`.

**Base URL** — use your deployed API origin, for example `https://api.example.com`. All examples below use `API_BASE`.

Enable **CORS** from your frontend origin (the server uses `cors` with `origin: true`, so browser requests from your SPA origin are allowed when credentials are used as needed).

---

## 1. `POST /login`

Starts a login attempt and returns a `request_id` for polling.

### Headers

| Header           | Value              |
|------------------|--------------------|
| `Content-Type`   | `application/json` |

### Mode A — Google Sign-In (ID token)

Send the **ID token** (JWT) from Google. The backend verifies it with Google and checks the audience matches a configured OAuth client ID.

**Body (either field is accepted):**

```json
{
  "credential": "<ID token from Google Identity Services / One Tap>"
}
```

or

```json
{
  "id_token": "<same JWT>"
}
```

- **One Tap / GIS** often returns the token in the callback as `credential`.
- **OAuth popup / redirect** flows usually expose `id_token` in the token response.

**Success `202`:**

```json
{
  "status": "pending",
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| `401` | Invalid or expired token, or Google email not verified |
| `503` | Server has no `GOOGLE_CLIENT_IDS` / `GOOGLE_CLIENT_ID` configured |

### Mode B — Demo username / password

```json
{
  "username": "admin",
  "password": "<configured demo password>"
}
```

Same `202` response shape as Google mode.

**Errors:**

| Status | Meaning |
|--------|---------|
| `401` | Wrong username or password |

---

## 2. `GET /login-status`

Poll until the request is no longer pending (or you time out on the client).

**Query:**

| Parameter     | Required | Description        |
|---------------|----------|--------------------|
| `request_id`  | yes      | From `POST /login` |

**Example:** `GET ${API_BASE}/login-status?request_id=<uuid>`

**Success `200`:**

```json
{ "status": "pending" }
```

```json
{ "status": "approved" }
```

```json
{ "status": "rejected" }
```

Pending requests expire on the server after a few minutes; they then behave like unknown/expired.

**Errors:**

| Status | Meaning |
|--------|---------|
| `400` | Missing `request_id` |
| `404` | Unknown or expired `request_id` |

---

## 3. Recommended client flow

1. Obtain a Google ID token (One Tap, button, or OAuth) **using the same OAuth client ID** that the backend lists in `GOOGLE_CLIENT_IDS` (or `GOOGLE_CLIENT_ID`).
2. `POST /login` with `{ "credential": token }` or `{ "id_token": token }`.
3. On `202`, read `request_id`.
4. Poll `GET /login-status?request_id=...` every 1–2 seconds (with a max wait your product defines, e.g. 2–3 minutes).
5. If `approved`, proceed (issue your own session/JWT in a future API if you add one).
6. If `rejected` or `404` / client timeout, show an error and allow retry.

---

## 4. Google Identity Services (browser) sketch

Use the [Google Identity Services](https://developers.google.com/identity/gsi/web) library. Your **Web client ID** must be included in the server env `GOOGLE_CLIENT_IDS` or `GOOGLE_CLIENT_ID`.

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

```javascript
const API_BASE = 'https://your-api.example.com';

async function loginWithGoogle(credentialResponse) {
  const credential = credentialResponse.credential;
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  if (res.status !== 202) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Login failed (${res.status})`);
  }
  const { request_id } = await res.json();
  return pollStatus(request_id);
}

async function pollStatus(requestId) {
  const deadline = Date.now() + 3 * 60 * 1000;
  while (Date.now() < deadline) {
    const r = await fetch(
      `${API_BASE}/login-status?request_id=${encodeURIComponent(requestId)}`
    );
    if (r.status === 404) return { status: 'rejected' };
    const data = await r.json();
    if (data.status !== 'pending') return data;
    await new Promise((x) => setTimeout(x, 1500));
  }
  return { status: 'timeout' };
}
```

Wire `loginWithGoogle` to the GIS callback that receives `credentialResponse`.

---

## 5. Health check

`GET /health` → `{ "ok": true }` for uptime checks (no auth).

---

## 6. Server env (reference for your DevOps)

| Variable | Role |
|----------|------|
| `GOOGLE_CLIENT_IDS` or `GOOGLE_CLIENT_ID` | OAuth client ID(s) allowed to mint ID tokens verified by `/login` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` | Telegram approval messages |
| `TELEGRAM_WEBHOOK_SECRET` | Optional; must match Telegram webhook secret |
| `DEMO_USERNAME`, `DEMO_PASSWORD` | Demo password mode |

The frontend only needs the **same Google Web client ID** in GIS/OAuth config as one of the IDs the server trusts; client IDs are public. Secrets stay on the server.
