'use strict';

const {
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_ADMIN_CHAT_ID
} = require('../config');

function tgApi(method, body) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(function (r) {
        return r.json().then(function (data) {
            if (!data.ok) {
                console.error('Telegram API error:', method, data);
            }
            return data;
        });
    });
}

function sendLoginApprovalMessage(requestId, userId, clientIp) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
        console.warn('Telegram not configured; skipping sendMessage');
        return Promise.resolve(null);
    }
    const text =
        'Login request\n\n' +
        'User: ' +
        userId +
        '\nIP: ' +
        clientIp +
        '\n\nApprove?';
    const approveData = 'approve:' + requestId;
    const rejectData = 'reject:' + requestId;
    return tgApi('sendMessage', {
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Approve', callback_data: approveData },
                    { text: '❌ Reject', callback_data: rejectData }
                ]
            ]
        }
    });
}

function parseCallbackData(data) {
    if (!data || typeof data !== 'string') return null;
    var i = data.indexOf(':');
    if (i <= 0) return null;
    var action = data.slice(0, i);
    var requestId = data.slice(i + 1);
    if (!requestId) return null;
    if (action !== 'approve' && action !== 'reject') return null;
    return { action, requestId };
}

module.exports = {
    tgApi,
    sendLoginApprovalMessage,
    parseCallbackData
};
