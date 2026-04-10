'use strict';

const { Router } = require('express');
const { TELEGRAM_WEBHOOK_SECRET } = require('../config');
const requestStore = require('../lib/requestStore');
const { tgApi, parseCallbackData } = require('../lib/telegram');

const router = Router();

router.post('/telegram/webhook', function (req, res) {
    if (TELEGRAM_WEBHOOK_SECRET) {
        var token = req.get('X-Telegram-Bot-Api-Secret-Token');
        if (token !== TELEGRAM_WEBHOOK_SECRET) {
            return res.status(403).send('Forbidden');
        }
    }

    var update = req.body;
    var cq = update && update.callback_query;
    if (!cq || !cq.data) {
        return res.sendStatus(200);
    }

    var parsed = parseCallbackData(cq.data);
    if (!parsed) {
        return res.sendStatus(200);
    }

    var rec = requestStore.getRaw(parsed.requestId);
    var message = cq.message;
    var chatId = message && message.chat && message.chat.id;
    var messageId = message && message.message_id;
    var actor =
        cq.from && (cq.from.username ? '@' + cq.from.username : 'id:' + cq.from.id);

    function answer(text, showAlert) {
        return tgApi('answerCallbackQuery', {
            callback_query_id: cq.id,
            text: text || '',
            show_alert: Boolean(showAlert)
        });
    }

    if (!rec) {
        console.log(
            '[telegram] callback ignored (unknown request)',
            JSON.stringify({ request_id: parsed.requestId, action: parsed.action, actor: actor || null })
        );
        answer('Request not found or expired.', true);
        return res.sendStatus(200);
    }

    if (rec.status !== 'pending') {
        console.log(
            '[telegram] callback ignored (already ' + rec.status + ')',
            JSON.stringify({ request_id: parsed.requestId, user: rec.userId, actor: actor || null })
        );
        answer('Already handled.', false);
        return res.sendStatus(200);
    }

    if (requestStore.now() > rec.expiresAt) {
        rec.status = 'rejected';
        console.log(
            '[telegram] login rejected (expired)',
            JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, actor: actor || null })
        );
        answer('Request expired.', true);
        return res.sendStatus(200);
    }

    if (parsed.action === 'approve') {
        rec.status = 'approved';
        console.log(
            '[telegram] login approved',
            JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, actor: actor || null })
        );
        answer('Approved.', false);
        if (chatId && messageId) {
            tgApi('editMessageText', {
                chat_id: chatId,
                message_id: messageId,
                text: 'Approved\n\nUser: ' + rec.userId + '\nIP: ' + rec.clientIp
            }).catch(function (e) {
                console.error('editMessageText failed:', e);
            });
        }
    } else {
        rec.status = 'rejected';
        console.log(
            '[telegram] login rejected',
            JSON.stringify({ request_id: parsed.requestId, user: rec.userId, client_ip: rec.clientIp, actor: actor || null })
        );
        answer('Rejected.', false);
        if (chatId && messageId) {
            tgApi('editMessageText', {
                chat_id: chatId,
                message_id: messageId,
                text: 'Rejected\n\nUser: ' + rec.userId + '\nIP: ' + rec.clientIp
            }).catch(function (e) {
                console.error('editMessageText failed:', e);
            });
        }
    }

    return res.sendStatus(200);
});

module.exports = router;
