'use strict';

const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client();

/**
 * @param {string} idToken
 * @param {string[]} audiences
 * @returns {Promise<{ sub: string, email?: string, email_verified?: boolean, name?: string, picture?: string }>}
 */
function verifyGoogleIdToken(idToken, audiences) {
    if (!idToken || typeof idToken !== 'string') {
        return Promise.reject(new Error('missing_token'));
    }
    if (!audiences.length) {
        return Promise.reject(new Error('not_configured'));
    }
    return client
        .verifyIdToken({
            idToken,
            audience: audiences.length === 1 ? audiences[0] : audiences
        })
        .then(function (ticket) {
            const payload = ticket.getPayload();
            if (!payload || !payload.sub) {
                throw new Error('invalid_payload');
            }
            return {
                sub: payload.sub,
                email: payload.email,
                email_verified: payload.email_verified,
                name: payload.name,
                picture: payload.picture
            };
        });
}

module.exports = { verifyGoogleIdToken };
