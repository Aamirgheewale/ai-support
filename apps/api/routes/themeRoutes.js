const express = require('express');
const router = express.Router();
const {
    updateSessionTheme,
    getSessionTheme
} = require('../controllers/themeController');

// POST /session/:sessionId/theme - Update session theme
router.post('/session/:sessionId/theme', updateSessionTheme);

// GET /session/:sessionId/theme - Get session theme
router.get('/session/:sessionId/theme', getSessionTheme);

module.exports = router;
