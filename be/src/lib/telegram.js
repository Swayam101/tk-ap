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
        text: body + '\n\nApprove?',
        reply_markup: {
            inline_keyboard: [[
                { text: '✅ Approve', callback_data: 'approve:' + requestId },
                { text: '❌ Reject',  callback_data: 'reject:'  + requestId }
            ]]
        }
    });
}

function parseCallback(data) {
    if (!data || typeof data !== 'string') return null;
    const i = data.indexOf(':');
    if (i <= 0) return null;
    const action = data.slice(0, i);
    const requestId = data.slice(i + 1);
    if (!requestId || (action !== 'approve' && action !== 'reject')) return null;
    return { action, requestId };
}

module.exports = { tgApi, sendApprovalMessage, parseCallback };
