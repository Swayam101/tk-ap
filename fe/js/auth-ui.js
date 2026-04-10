(function (global) {
    var overlayEl;
    var bannerEl;

    function init() {
        overlayEl = document.getElementById('authGateOverlay');
        bannerEl  = document.getElementById('authStatusBanner');
    }

    function setBanner(message, kind) {
        if (!bannerEl) return;
        bannerEl.textContent = message || '';
        bannerEl.hidden = !message;
        bannerEl.classList.remove('auth-banner--error', 'auth-banner--success');
        if (kind === 'error')   bannerEl.classList.add('auth-banner--error');
        if (kind === 'success') bannerEl.classList.add('auth-banner--success');
    }

    function clearBanner() {
        setBanner('', null);
    }

    function showLoader() {
        if (!overlayEl) return;
        overlayEl.hidden = false;
        overlayEl.setAttribute('aria-hidden', 'false');
    }

    function hideLoader() {
        if (!overlayEl) return;
        overlayEl.hidden = true;
        overlayEl.setAttribute('aria-hidden', 'true');
    }

    function runGate(fn) {
        clearBanner();
        showLoader();
        return fn()
            .then(function (result) {
                var status = result && result.status;
                hideLoader();

                if (status === 'approved') {
                    setBanner('Signed in.', 'success');
                    var cfg = global.APP_CONFIG || {};
                    var redirectUrl = String(cfg.afterLoginRedirectUrl || '').trim();
                    if (redirectUrl) {
                        var delay = Number(cfg.afterLoginRedirectDelayMs);
                        if (!Number.isFinite(delay) || delay < 0) delay = 0;
                        function go() { global.location.assign(redirectUrl); }
                        delay > 0 ? setTimeout(go, delay) : go();
                    }
                    return result;
                }

                if (status === 'rejected') {
                    setBanner('Unable to sign in. Please try again.', 'error');
                } else if (status === 'timeout') {
                    setBanner('Timed out. Try again.', 'error');
                } else {
                    setBanner('Something went wrong.', 'error');
                }
                return result;
            })
            .catch(function (err) {
                hideLoader();
                setBanner(err.message || 'Request failed.', 'error');
                throw err;
            });
    }

    global.AuthUI = { init, setBanner, clearBanner, runGate, hideLoader };
})(window);
