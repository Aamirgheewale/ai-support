const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authController = require('../controllers/authController');

// Middleware
const { requireAuth, requireRole, requireAdminAuth } = authController;

// ============================================================================
// DASHBOARD STATS
// ============================================================================

// GET /admin/dashboard/stats - Main dashboard KPI and charts
// (Mounted at /admin, so path is /dashboard/stats)
router.get('/dashboard/stats', requireAuth, requireRole(['admin']), dashboardController.getDashboardStats);


// ============================================================================
// ANALYTICS & METRICS
// ============================================================================

// GET /admin/metrics/overview - Key metrics overview
router.get('/metrics/overview', requireAdminAuth, dashboardController.getOverviewMetrics);

// GET /admin/metrics/messages-over-time - Time series data
router.get('/metrics/messages-over-time', requireAdminAuth, dashboardController.getMessagesOverTime);

// GET /admin/metrics/agent-performance - Agent performance leaderboards
router.get('/metrics/agent-performance', requireAdminAuth, dashboardController.getAgentPerformance);

// GET /admin/metrics/confidence-histogram - AI Confidence distribution
router.get('/metrics/confidence-histogram', requireAdminAuth, dashboardController.getConfidenceHistogram);

// GET /admin/metrics/response-times - Response time percentiles
router.get('/metrics/response-times', requireAdminAuth, dashboardController.getResponseTimes);

// POST /admin/metrics/aggregate-request - Request background aggregation
router.post('/metrics/aggregate-request', requireAdminAuth, dashboardController.requestAggregation);

module.exports = router;
