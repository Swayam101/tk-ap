'use strict';

const { Router } = require('express');
const { TELEGRAM_WEBHOOK_SECRET } = require('../config');
const store = require('../lib/store');
const { tgApi, parseCallback } = require('../lib/telegram');

const router = Router();

router.post('/telegram/webhook', function (req, res) {
    if (TELEGRAM_WEBHOOK_SECRET) {
        const token = req.get('X-Telegram-Bot-Api-Secret-Token');
        if (token !== TELEGRAM_WEBHOOK_SECRET) return res.status(403).send('Forbidden');
    }

    const cq = req.body && req.body.callback_query;
    if (!cq || !cq.data) return res.sendStatus(200);

    const parsed = parseCallback(cq.data);
    if (!parsed) return res.sendStatus(200);

    const rec = store.get(parsed.requestId);
    const msg = cq.message;
    const chatId = msg && msg.chat && msg.chat.id;
    const messageId = msg && msg.message_id;
    const actor = cq.from && (cq.from.username ? '@' + cq.from.username : 'id:' + cq.from.id);

    function answer(text, showAlert) {
        return tgApi('answerCallbackQuery', {
            callback_query_id: cq.id,
            text: text || '',
            show_alert: Boolean(showAlert)
        });
    }

    function editMessage(label) {
        if (!chatId || !messageId) return;
        tgApi('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: `${label}\n\n${rec.userId}\nIP: ${rec.clientIp}`
        }).catch(e => console.error('editMessageText failed:', e));
    }

    if (!rec) {
        console.log('[telegram] callback ignored (unknown request)', JSON.stringify({ request_id: parsed.requestId, action: parsed.action, actor: actor || null }));
        answer('Request not found or expired.', true);
        return res.sendStatus(200);
    }

    if (rec.status !== 'pending') {
        console.log('[telegram] callback ignored (already ' + rec.status + ')', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, actor: actor || null }));
        answer('Already handled.', false);
        return res.sendStatus(200);
    }

    if (store.now() > rec.expiresAt) {
        rec.status = 'rejected';
        console.log('[telegram] login rejected (expired)', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, actor: actor || null }));
        answer('Request expired.', true);
        return res.sendStatus(200);
    }

    if (parsed.action === 'approve') {
        rec.status = 'approved';
        console.log('[telegram] login approved', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, actor: actor || null }));
        answer('Approved.', false);
        editMessage('Approved');
    } else {
        rec.status = 'rejected';
        console.log('[telegram] login rejected', JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, actor: actor || null }));
        answer('Rejected.', false);
        editMessage('Rejected');
    }

    return res.sendStatus(200);
});

module.exports = router;
