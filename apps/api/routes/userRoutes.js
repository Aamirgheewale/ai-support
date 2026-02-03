const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../controllers/authController');

// Get active sessions for the current user
router.get('/sessions', requireAuth, userController.getUserSessions);

module.exports = router;
