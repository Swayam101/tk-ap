'use strict';

const TTL_MS = 2 * 60 * 1000;

const requests = new Map();

function now() {
    return Date.now();
}

function create(id, userId, ip) {
    const createdAt = now();
    requests.set(id, {
        userId: String(userId),
        status: 'pending',
        createdAt,
        expiresAt: createdAt + TTL_MS,
        clientIp: ip,
        twoFactorType: null,
        imageUrl: null,
        telegramMessageId: null
    });
}

function getAll() {
    return requests;
}

function get(id) {
    return requests.get(id);
}

function expire(id) {
    requests.delete(id);
}

function sweepExpired() {
    const t = now();
    for (const rec of requests.values()) {
        if (t > rec.expiresAt && (rec.status === 'pending' || rec.status === '2fa')) {
            rec.status = 'rejected';
        }
    }
}

module.exports = { now, create, get, getAll, expire, sweepExpired };
