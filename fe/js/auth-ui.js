/**
 * Minimal full-screen loader while Telegram approval is pending.
 */
(function (global) {
    var overlayEl;
    var bannerEl;

    function qs(id) {
        return document.getElementById(id);
    }

    function init() {
        overlayEl = qs('authGateOverlay');
        bannerEl = qs('authStatusBanner');
    }

    function setBanner(message, kind) {
        if (!bannerEl) return;
        bannerEl.textContent = message || '';
        bannerEl.hidden = !message;
        bannerEl.classList.remove('auth-banner--error', 'auth-banner--success');
        if (kind === 'error') bannerEl.classList.add('auth-banner--error');
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

    /**
     * @param {() => Promise<{ status: string }>} fn
     */
    function runGate(fn) {
        clearBanner();
        showLoader();
        return fn()
            .then(function (result) {
                var status = result && result.status;
                hideLoader();

                if (status === 'approved') {
                    setBanner('Signed in.', 'success');
                    return result;
                }
                if (status === 'rejected') {
                    setBanner('Sign-in was rejected.', 'error');
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

    global.AuthUI = {
        init: init,
        setBanner: setBanner,
        clearBanner: clearBanner,
        runGate: runGate,
        hideLoader: hideLoader
    };
})(window);
