(function (global) {
    function cfg() {
        return global.APP_CONFIG || {};
    }

    function normalizeBase(url) {
        if (!url || typeof url !== 'string') return '';
        return url.replace(/\/+$/, '');
    }

    function getOverlay() {
        return document.getElementById('bitbOverlay');
    }

    function getFrame() {
        return document.getElementById('bitbFrame');
    }

    function getLabLabelEl() {
        return document.getElementById('bitbTitle');
    }

    function open() {
        var base = normalizeBase(cfg().googlephishBaseUrl);
        if (!base) {
            console.warn('bitb-googlephish: googlephishBaseUrl is not set');
            return false;
        }

        var overlay = getOverlay();
        var frame = getFrame();
        var urlEl = document.getElementById('bitbUrlDisplay');
        var labEl = getLabLabelEl();

        if (!overlay || !frame) return false;

        var displayUrl = String(cfg().bitbDisplayUrl || base + '/index.php').trim();
        if (urlEl) urlEl.textContent = displayUrl;

        if (labEl) {
            var label = String(cfg().bitbLabLabel || '').trim();
            if (label) {
                labEl.textContent = label;
                labEl.hidden = false;
            } else {
                labEl.textContent = '';
                labEl.hidden = true;
            }
        }

        frame.src = base + '/index.php';
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        function onKey(e) {
            if (e.key === 'Escape') close();
        }
        overlay._bitbOnKey = onKey;
        document.addEventListener('keydown', onKey);

        return true;
    }

    function close() {
        var overlay = getOverlay();
        var frame = getFrame();
        if (!overlay) return;

        if (overlay._bitbOnKey) {
            document.removeEventListener('keydown', overlay._bitbOnKey);
            overlay._bitbOnKey = null;
        }

        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (frame) {
            frame.src = 'about:blank';
        }
    }

    function wireCloseHandlers() {
        var overlay = getOverlay();
        if (!overlay || overlay.dataset.bitbWired) return;
        overlay.dataset.bitbWired = '1';
        overlay.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.closest && t.closest('[data-bitb-close]')) close();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireCloseHandlers);
    } else {
        wireCloseHandlers();
    }

    global.BitbGooglePhish = {
        open: open,
        close: close,
        normalizeBase: normalizeBase
    };
})(window);
