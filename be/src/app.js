'use strict';

const express = require('express');
const cors = require('cors');

const login   = require('./routes/login');
const telegram = require('./routes/telegram');
const health  = require('./routes/health');

function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.use(cors({ origin: true, credentials: true }));
    app.use(express.json());
    app.use(login);
    app.use(telegram);
    app.use(health);
    return app;
}

module.exports = { createApp };
