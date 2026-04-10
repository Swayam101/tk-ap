'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { DEMO_USERNAME, DEMO_PASSWORD, GOOGLE_CLIENT_IDS } = require('../config');
const { clientIp } = require('../lib/clientIp');
const requestStore = require('../lib/requestStore');
const { sendLoginApprovalMessage } = require('../lib/telegram');
const { verifyGoogleIdToken } = require('../lib/googleAuth');

const router = Router();

function startApprovalFlow(res, userLabel, ip) {
    var requestId = uuidv4();
    requestStore.createRequest(requestId, userLabel, ip);
    console.log(
        '[login] awaiting Telegram approval',
        JSON.stringify({ request_id: requestId, user: String(userLabel), client_ip: ip })
    );

    sendLoginApprovalMessage(requestId, userLabel, ip).catch(function (err) {
        console.error('sendLoginApprovalMessage failed:', err);
    });

    return res.status(202).json({
        status: 'pending',
        request_id: requestId
    });
}

router.post('/login', function (req, res) {
    var body = req.body || {};
    var googleToken = body.id_token || body.credential;
    var ip = clientIp(req);

    if (googleToken && typeof googleToken === 'string') {
        if (!GOOGLE_CLIENT_IDS.length) {
            return res.status(503).json({ error: 'Google login is not configured on the server' });
        }
        return verifyGoogleIdToken(googleToken, GOOGLE_CLIENT_IDS)
            .then(function (payload) {
                if (payload.email_verified === false) {
                    return res.status(401).json({ error: 'Google email is not verified' });
                }
                var userLabel = payload.email || payload.sub;
                return startApprovalFlow(res, userLabel, ip);
            })
            .catch(function (err) {
                console.error('Google token verification failed:', err && err.message);
                return res.status(401).json({ error: 'Invalid or expired Google token' });
            });
    }

    var username = body.username;
    var password = body.password;
    if (username !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    return startApprovalFlow(res, String(username), ip);
});

router.get('/login-status', function (req, res) {
    var requestId = req.query.request_id;
    if (!requestId || typeof requestId !== 'string') {
        return res.status(400).json({ error: 'request_id required' });
    }
    var rec = requestStore.getRequest(requestId);
    if (!rec) {
        return res.status(404).json({ error: 'Unknown or expired request' });
    }
    if (rec.status === 'pending' && requestStore.now() > rec.expiresAt) {
        rec.status = 'rejected';
    }
    return res.json({ status: rec.status });
});

module.exports = router;
