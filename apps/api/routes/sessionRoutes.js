const express = require('express');
const router = express.Router();
const {
    getSessions,
    getAssignments,
    getAgentSessions,
    getSessionMessages,
    assignSession,
    closeSession,
    updateSessionStatus,
    getActiveSessions,
    exportSession,
    bulkExportSessions
} = require('../controllers/sessionController');

const {
    requireAuth,
    requireRole,
    requireAdminAuth
} = require('../controllers/authController');

// Define routes
// NOTE: Ordering matters! Specific routes before parameter routes.

// GET /active - List active sessions
router.get('/active', requireAdminAuth, getActiveSessions);

// GET /assignments - List sessions needing human
router.get('/assignments', requireAdminAuth, getAssignments);

// POST /export - Bulk export (must be before /:sessionId)
router.post('/export', requireAdminAuth, bulkExportSessions);

// GET / - List sessions
router.get('/', requireAdminAuth, getSessions);

// GET /agent/:agentId
router.get('/agent/:agentId', requireAuth, requireRole(['admin', 'agent']), getAgentSessions);

// GET /:sessionId/messages
router.get('/:sessionId/messages', requireAdminAuth, getSessionMessages);

// GET /:sessionId/export
router.get('/:sessionId/export', requireAdminAuth, exportSession);

// POST /:sessionId/assign
router.post('/:sessionId/assign', requireAuth, requireRole(['admin', 'agent']), assignSession);

// POST /:sessionId/close
router.post('/:sessionId/close', requireAdminAuth, closeSession);

// PATCH /:sessionId/status
router.patch('/:sessionId/status', requireAdminAuth, updateSessionStatus);

module.exports = router;
