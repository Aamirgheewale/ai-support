const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authController = require('../controllers/authController');

// Middleware
const { requireAuth, requireRole, requirePermission, requireAdminAuth } = authController;

// ============================================================================
// DASHBOARD STATS
// ============================================================================

// GET /admin/dashboard/stats - Main dashboard KPI and charts
// (Mounted at /admin, so path is /dashboard/stats)
router.get('/dashboard/stats', requireAuth, requirePermission('dashboard'), dashboardController.getDashboardStats);


// ============================================================================
// ANALYTICS & METRICS
// ============================================================================

// GET /admin/metrics/overview - Key metrics overview
router.get('/metrics/overview', requireAuth, requirePermission('analytics'), dashboardController.getOverviewMetrics);

// GET /admin/metrics/messages-over-time - Time series data
router.get('/metrics/messages-over-time', requireAuth, requirePermission('analytics'), dashboardController.getMessagesOverTime);

// GET /admin/metrics/agent-performance - Agent performance leaderboards
router.get('/metrics/agent-performance', requireAuth, requirePermission('analytics'), dashboardController.getAgentPerformance);

// GET /admin/metrics/confidence-histogram - AI Confidence distribution
router.get('/metrics/confidence-histogram', requireAuth, requirePermission('analytics'), dashboardController.getConfidenceHistogram);

// GET /admin/metrics/response-times - Response time percentiles
router.get('/metrics/response-times', requireAuth, requirePermission('analytics'), dashboardController.getResponseTimes);

// POST /admin/metrics/aggregate-request - Request background aggregation
router.post('/metrics/aggregate-request', requireAuth, requirePermission('analytics'), dashboardController.requestAggregation);

module.exports = router;
