const express = require('express');
const router = express.Router();
const {
    proxyImage,
    getAccuracyRecords,
    getAccuracyStats,
    getEncryptionStatus,
    reencryptData,
    cleanupPlaintext,
    getEncryptionAudit,
    healthCheck,
    dbHealthCheck
} = require('../controllers/systemController');

const {
    requireAuth,
    requireRole
} = require('../controllers/authController');

// Image Proxy (Authenticated)
// Mounted at /api/proxy/image -> so route here is /image ? NO. 
// Plan said: app.use('/api/system', systemRoutes)
// Original: /api/proxy/image
// If I mount at /api/system, then it becomes /api/system/proxy/image.
// To keep backward compatibility seamlessly without changing frontend:
// I should probably mount these specifically in index.js or route them carefully.
// Let's assume I will mount systemRoutes at `/` in index.js to keep full control of paths here.
// Or I can mount at `/api` and define `proxy/image`.

// Let's use specific paths here and mount at root `/` in index.js for maximum flexibility of legacy paths.

// GET /api/proxy/image
router.get('/api/proxy/image', requireAuth, proxyImage);

// GET /admin/accuracy
router.get('/admin/accuracy', requireAuth, requireRole(['admin']), getAccuracyRecords);

// GET /admin/accuracy/stats
router.get('/admin/accuracy/stats', requireAuth, requireRole(['admin']), getAccuracyStats);

// Encryption Management
router.get('/admin/encryption/status', requireAuth, requireRole(['admin']), getEncryptionStatus);
router.post('/admin/encryption/reencrypt', requireAuth, requireRole(['admin']), reencryptData);
router.post('/admin/encryption/cleanup-plaintext', requireAuth, requireRole(['admin']), cleanupPlaintext);
router.get('/admin/encryption/audit', requireAuth, requireRole(['admin']), getEncryptionAudit);

// Health Checks
router.get('/', healthCheck);
router.get('/health/db', dbHealthCheck);

module.exports = router;
