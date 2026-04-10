'use strict';

const PORT = Number(process.env.PORT) || 4000;
const DEMO_USERNAME = process.env.DEMO_USERNAME || 'admin';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'changeme';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const REQUEST_TTL_MS = 2 * 60 * 1000;

/** OAuth 2.0 client IDs (Web, iOS, Android) that may mint ID tokens — comma-separated */
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
    .split(',')
    .map(function (s) {
        return s.trim();
    })
    .filter(Boolean);

module.exports = {
    PORT,
    DEMO_USERNAME,
    DEMO_PASSWORD,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_ADMIN_CHAT_ID,
    TELEGRAM_WEBHOOK_SECRET,
    REQUEST_TTL_MS,
    GOOGLE_CLIENT_IDS
};
