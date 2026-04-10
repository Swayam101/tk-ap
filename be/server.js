require('dotenv').config();

const { createApp } = require('./src/app');
const { PORT, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID } = require('./src/config');

const app = createApp();

app.listen(PORT, function () {
    console.log('tk-be listening on http://localhost:' + PORT);
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
        console.warn('Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in .env for Telegram approvals.');
    }
});
