const express = require('express');
const router = express.Router();
const { requireAuth, requireAdminAuth } = require('../controllers/authController');
const {
    getAllConfigs,
    getActiveConfig,
    upsertConfig,
    activateConfig,
    deleteConfig,
    updateConfigKey,
    getSystemPrompt,
    saveSystemPrompt,
    getContextLimit,
    saveContextLimit,
    getWelcomeMessage,
    saveWelcomeMessage,
    getImagePrompt,
    saveImagePrompt
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

// --- System Prompt Settings ---

// GET System Prompt
router.get('/system-prompt', requireAuth, requireAdminAuth, getSystemPrompt);

// POST System Prompt
router.post('/system-prompt', requireAuth, requireAdminAuth, saveSystemPrompt);

// --- Context Limit Settings ---

// GET Context Limit
router.get('/context-limit', requireAuth, requireAdminAuth, getContextLimit);

// POST Context Limit
router.post('/context-limit', requireAuth, requireAdminAuth, saveContextLimit);

// --- Welcome Message Settings ---

// GET Welcome Message
router.get('/welcome-message', requireAuth, requireAdminAuth, getWelcomeMessage);

// POST Welcome Message
router.post('/welcome-message', requireAuth, requireAdminAuth, saveWelcomeMessage);

// --- Image Analysis Prompt Settings ---

// GET Image Prompt
router.get('/image-prompt', requireAuth, requireAdminAuth, getImagePrompt);

// POST Image Prompt
router.post('/image-prompt', requireAuth, requireAdminAuth, saveImagePrompt);

module.exports = router;
