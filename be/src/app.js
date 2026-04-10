'use strict';

const express = require('express');
const cors = require('cors');
const loginRoutes = require('./routes/login');
const telegramRoutes = require('./routes/telegram');
const healthRoutes = require('./routes/health');

function createApp() {
    const app = express();
    app.disable('x-powered-by');
    
    app.use(cors({ origin: true, credentials: true }));
    app.use(express.json({ limit: '256kb' }));

    app.use(loginRoutes);
    app.use(telegramRoutes);
    app.use(healthRoutes);

    return app;
}

module.exports = { createApp };
