'use strict';

const { Router } = require('express');

const router = Router();

router.get('/health', function (req, res) {
    res.json({ ok: true });
});

module.exports = router;
