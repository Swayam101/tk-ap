(function (global) {
    var bannerEl;

    function init() {
        bannerEl = document.getElementById('authStatusBanner');
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

    global.AuthUI = { init, setBanner, clearBanner };
})(window);
