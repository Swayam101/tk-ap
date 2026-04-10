'use strict';

const { REQUEST_TTL_MS } = require('../config');

/** @type {Map<string, { userId: string, status: 'pending'|'approved'|'rejected', createdAt: number, expiresAt: number, clientIp: string }>} */
const requests = new Map();

function now() {
    return Date.now();
}

function cleanupExpired() {
    const t = now();
    for (const [id, req] of requests.entries()) {
        if (t > req.expiresAt && req.status === 'pending') {
            req.status = 'rejected';
        }
    }
}

function getRequest(id) {
    cleanupExpired();
    return requests.get(id);
}

function createRequest(requestId, userId, clientIp) {
    const createdAt = now();
    const expiresAt = createdAt + REQUEST_TTL_MS;
    requests.set(requestId, {
        userId: String(userId),
        status: 'pending',
        createdAt,
        expiresAt,
        clientIp
    });
}

function getRaw(requestId) {
    return requests.get(requestId);
}

module.exports = {
    getRequest,
    createRequest,
    getRaw,
    now
};
