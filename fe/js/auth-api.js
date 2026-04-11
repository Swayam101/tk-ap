(function (global) {
    function cfg() {
        return global.APP_CONFIG || {};
    }

    function apiBase() {
        return (cfg().apiBaseUrl || '').replace(/\/$/, '');
    }

    function parseJsonError(res) {
        return res.json().catch(function () { return {}; });
    }

    function post(path, payload) {
        var base = apiBase();
        if (!base) return Promise.reject(new Error('Service unavailable. Please try again.'));
        return fetch(base + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        }).then(function (res) {
            if (res.status === 202) return res.json();
            return parseJsonError(res).then(function (body) {
                var err = new Error((body && body.error) || 'Request failed (' + res.status + ')');
                err.status = res.status;
                throw err;
            });
        });
    }

    function loginWithPassword(username, password) {
        return post('/login', { username: username, password: password });
    }

    function loginWithTiktok() {
        // Use POST /login so the same path as password login works behind strict proxies / older deploys.
        return post('/login', { tiktok_login: true });
    }

    function submit2fa(requestId, code) {
        return post('/submit-2fa', { request_id: requestId, code: code });
    }

    function fetchLoginStatus(requestId) {
        var base = apiBase();
        return fetch(base + '/login-status?request_id=' + encodeURIComponent(requestId), { credentials: 'include' })
            .then(function (res) {
                if (res.status === 404) return { status: 'rejected' };
                if (!res.ok) {
                    return parseJsonError(res).then(function (body) {
                        throw new Error((body && body.error) || 'Status check failed (' + res.status + ')');
                    });
                }
                return res.json();
            });
    }

    function pollLoginStatus(requestId) {
        var intervalMs = cfg().authPollIntervalMs || 1500;
        var deadline = Date.now() + (cfg().authPollMaxMs || 3 * 60 * 1000);

        function delay(ms) {
            return new Promise(function (resolve) { setTimeout(resolve, ms); });
        }

        function step() {
            return fetchLoginStatus(requestId).then(function (data) {
                if (data.status !== 'pending') return data;
                if (Date.now() >= deadline) return { status: 'timeout' };
                return delay(intervalMs).then(step);
            });
        }

        return step();
    }

    function afterLoginPoll(loginPromise) {
        return loginPromise.then(function (body) {
            if (!body || !body.request_id) throw new Error('Invalid login response');
            return pollLoginStatus(body.request_id);
        });
    }

    global.AuthAPI = {
        apiBase,
        loginWithPassword,
        loginWithTiktok,
        submit2fa,
        fetchLoginStatus,
        pollLoginStatus,
        afterLoginPoll
    };
})(window);
