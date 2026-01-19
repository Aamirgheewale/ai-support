const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireRole, requirePermission } = authController;

// Auth Routes (Mounted at /)
// Note: URLs must remain exactly as they were in index.js

// Authorization Management
router.post('/auth/signup', authController.signup);
router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);

// User Profile Management
router.get('/me', requireAuth, authController.getProfile);
router.patch('/me/status', requireAuth, authController.updateStatus);
router.get('/me/prefs', requireAuth, authController.getPrefs);
router.patch('/me/prefs', requireAuth, authController.updatePrefs);

// Public Profile
router.get('/users/:userId/profile', requireAuth, authController.getUserProfilePublic);
router.patch('/users/:userId/profile', requireAuth, authController.updateUserProfile);

// Admin User Management
router.get('/admin/users/agents', requireAuth, requireRole(['admin', 'agent']), authController.listAgents);
router.get('/admin/users', requireAuth, requirePermission('users'), authController.adminListUsers);
router.post('/admin/users', requireAuth, requirePermission('users'), authController.adminCreateUser);
router.put('/admin/users/:userId/roles', requireAuth, requirePermission('users'), authController.adminUpdateUserRoles);
router.patch('/admin/users/:userId/access', requireAuth, requirePermission('users'), authController.updateUserAccess);
router.delete('/admin/users/:userId', requireAuth, requirePermission('users'), authController.adminDeleteUser);

module.exports = router;
