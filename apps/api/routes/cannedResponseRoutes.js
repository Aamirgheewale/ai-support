const express = require('express');
const router = express.Router();
const {
    getCannedResponses,
    createCannedResponse,
    updateCannedResponse,
    deleteCannedResponse
} = require('../controllers/cannedResponseController');

const {
    requireAuth,
    requireRole
} = require('../controllers/authController');

// Middleware for all canned response routes
const adminAgentAuth = [requireAuth, requireRole(['admin', 'agent'])];

// GET /api/canned-responses - List
router.get('/', adminAgentAuth, getCannedResponses);

// POST /api/canned-responses - Create
router.post('/', adminAgentAuth, createCannedResponse);

// PUT /api/canned-responses/:id - Update
router.put('/:id', adminAgentAuth, updateCannedResponse);

// DELETE /api/canned-responses/:id - Delete
router.delete('/:id', adminAgentAuth, deleteCannedResponse);

module.exports = router;
