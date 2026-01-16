const express = require('express');
const router = express.Router();
const {
    createTicket,
    getTickets,
    replyToTicket
} = require('../controllers/ticketController');

const {
    requireAuth,
    requireRole
} = require('../controllers/authController');

// POST /api/tickets - Create new ticket (Public)
router.post('/', createTicket);

// GET /api/tickets - List all tickets (Admin/Agent)
router.get('/', requireAuth, requireRole(['admin', 'agent']), getTickets);

// POST /api/tickets/reply - Reply to ticket (Admin/Agent)
router.post('/reply', requireAuth, requireRole(['admin', 'agent']), replyToTicket);

module.exports = router;
