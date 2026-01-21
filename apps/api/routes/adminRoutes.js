const express = require('express');
const router = express.Router();
const { requireAuth, requireAdminAuth } = require('../controllers/authController');
const {
    getAllConfigs,
    getActiveConfig,
    upsertConfig,
    activateConfig,
    deleteConfig,
    updateConfigKey
} = require('../controllers/llmController');

// GET Active Config (Legacy/Dashboard support)
router.get('/llm-config', requireAuth, requireAdminAuth, getActiveConfig);

// GET All Configs (Fleet Manager)
router.get('/llm-configs', requireAuth, requireAdminAuth, getAllConfigs);

// POST Upsert Config (Add/Update & Activate)
router.post('/llm-config', requireAuth, requireAdminAuth, upsertConfig);

// PATCH Update API Key only (Partial Update / Heal)
router.patch('/llm-config/:id', requireAuth, requireAdminAuth, updateConfigKey);

// PATCH Activate Config by ID
router.patch('/llm-config/:id/activate', requireAuth, requireAdminAuth, activateConfig);

// DELETE Config by ID
router.delete('/llm-config/:id', requireAuth, requireAdminAuth, deleteConfig);

module.exports = router;
