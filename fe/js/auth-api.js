/**
 * Telegram-gated login API client (POST /login, GET /login-status).
 * Depends on window.APP_CONFIG from config.js.
 */
(function (global) {
    function cfg() {
        return global.APP_CONFIG || {};
    }

    function apiBase() {
        return (cfg().apiBaseUrl || '').replace(/\/$/, '');
    }

    function parseJsonError(res) {
        return res.json().catch(function () {
            return {};
        });
    }

    function loginWithPassword(username, password) {
        var base = apiBase();
        if (!base) {
            return Promise.reject(new Error('apiBaseUrl is not set in config.js'));
        }
        return fetch(base + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username: username, password: password })
        }).then(function (res) {
            if (res.status === 202) {
                return res.json();
            }
            return parseJsonError(res).then(function (body) {
                var msg = (body && body.error) || 'Login failed (' + res.status + ')';
                var err = new Error(msg);
                err.status = res.status;
                throw err;
            });
        });
    }

    function loginWithGoogle(credentialOrIdToken) {
        var base = apiBase();
        if (!base) {
            return Promise.reject(new Error('apiBaseUrl is not set in config.js'));
        }
        return fetch(base + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ credential: credentialOrIdToken })
        }).then(function (res) {
            if (res.status === 202) {
                return res.json();
            }
            return parseJsonError(res).then(function (body) {
                var msg = (body && body.error) || 'Login failed (' + res.status + ')';
                var err = new Error(msg);
                err.status = res.status;
                throw err;
            });
        });
    }

    function fetchLoginStatus(requestId) {
        var base = apiBase();
        return fetch(
            base + '/login-status?request_id=' + encodeURIComponent(requestId),
            { credentials: 'include' }
        ).then(function (res) {
            if (res.status === 404) {
                return { status: 'rejected' };
            }
            if (!res.ok) {
                return parseJsonError(res).then(function (body) {
                    var msg = (body && body.error) || 'Status check failed (' + res.status + ')';
                    throw new Error(msg);
                });
            }
            return res.json();
        });
    }

    function pollLoginStatus(requestId) {
        var intervalMs = cfg().authPollIntervalMs || 1500;
        var maxMs = cfg().authPollMaxMs || 3 * 60 * 1000;
        var deadline = Date.now() + maxMs;

        function delay(ms) {
            return new Promise(function (resolve) {
                setTimeout(resolve, ms);
            });
        }

        function step() {
            return fetchLoginStatus(requestId).then(function (data) {
                if (data.status !== 'pending') {
                    return data;
                }
                if (Date.now() >= deadline) {
                    return { status: 'timeout' };
                }
                return delay(intervalMs).then(step);
            });
        }

        return step();
    }

    function afterLoginPoll(loginPromise) {
        return loginPromise.then(function (body) {
            if (!body || !body.request_id) {
                throw new Error('Invalid login response');
            }
            return pollLoginStatus(body.request_id);
        });
    }

    global.AuthAPI = {
        apiBase: apiBase,
        loginWithPassword: loginWithPassword,
        loginWithDemo: loginWithPassword,
        loginWithGoogle: loginWithGoogle,
        fetchLoginStatus: fetchLoginStatus,
        pollLoginStatus: pollLoginStatus,
        afterLoginPoll: afterLoginPoll
    };
})(window);
