const express = require('express');
const router = express.Router();
const {
    getNotifications,
    createNotification,
    markNotificationRead,
    deleteNotification
} = require('../controllers/notificationController');

const {
    requireAuth,
    requireRole
} = require('../controllers/authController');

// Middleware
const adminAgentAuth = [requireAuth, requireRole(['admin', 'agent'])];

// GET /api/notifications
router.get('/', adminAgentAuth, getNotifications);

// POST /api/notifications/create
router.post('/create', adminAgentAuth, createNotification);

// PATCH /api/notifications/:id/read (Note: requireAuth only in original, checking if admin/agent needed? Original used requireAuth)
// Kept consistent with original: requireAuth only (users can read their own?) - Logic in controller doesn't restrict to admin/agent, so likely generic auth.
router.patch('/:id/read', requireAuth, markNotificationRead);

// DELETE /api/notifications/:id
router.delete('/:id', adminAgentAuth, deleteNotification);

module.exports = router;
