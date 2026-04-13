'use strict';

const PORT                = Number(process.env.PORT) || 4000;
const API_BASE_URL        = process.env.API_BASE_URL || '';
const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN  || '';
const TELEGRAM_ADMIN_CHAT_ID   = process.env.TELEGRAM_ADMIN_CHAT_ID   || '';
const TELEGRAM_WEBHOOK_SECRET  = process.env.TELEGRAM_WEBHOOK_SECRET  || '';

module.exports = {
    PORT,
    API_BASE_URL,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_ADMIN_CHAT_ID,
    TELEGRAM_WEBHOOK_SECRET
};
