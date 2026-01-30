const { awDatabases, config, encryption } = require('../config/clients');
const { Query, ID } = require('node-appwrite');

const {
    APPWRITE_DATABASE_ID,
    APPWRITE_LLM_SETTINGS_COLLECTION_ID
} = config;

// Helper to mask key
const maskKey = () => '********';

/**
 * GET /api/admin/llm-configs
 * Returns all configured LLM models (Fleet)
 */
const getAllConfigs = async (req, res) => {
    try {
        const result = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            [Query.limit(100), Query.orderDesc('$createdAt')]
        );

        const configs = result.documents.map(doc => ({
            $id: doc.$id,
            provider: doc.provider,
            model: doc.model,
            isActive: doc.isActive,
            healthStatus: doc.healthStatus || 'ok',
            lastError: doc.lastError || ''
            // Never return 'encryptedApiKey' or 'apiKey'
        }));

        res.json({ configs });
    } catch (error) {
        console.error('Error fetching LLM fleet:', error);
        res.status(500).json({ message: 'Failed to fetch configurations' });
    }
};

/**
 * GET /api/admin/llm-config (Active)
 * Returns the currently active config (Legacy + Dashboard Card)
 */
const getActiveConfig = async (req, res) => {
    try {
        const result = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            [Query.equal('isActive', true), Query.limit(1)]
        );

        if (result.documents.length === 0) {
            return res.json({ provider: 'google', model: 'gemini-1.5-flash', apiKey: '********' });
        }

        const doc = result.documents[0];
        return res.json({
            $id: doc.$id,
            provider: doc.provider,
            model: doc.model,
            apiKey: maskKey(),
            healthStatus: doc.healthStatus || 'ok',
            lastError: doc.lastError || ''
        });
    } catch (error) {
        console.error('Error fetching active LLM config:', error);
        res.status(500).json({ message: 'Failed to fetch configuration' });
    }
};

/**
 * POST /api/admin/llm-config (Upsert)
 * Creates new or updates existing config for (Provider + Model)
 * Sets as ACTIVE automatically.
 */
const upsertConfig = async (req, res) => {
    const { provider, model, apiKey, baseUrl } = req.body;

    if (!provider || !model) {
        return res.status(400).json({ message: 'Provider and Model are required' });
    }

    try {
        // 1. Check if a config with this Provider + Model already exists AND is different from other docs?
        // Actually, we just want to look for "provider" AND "model".
        const existingDocs = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            [
                Query.equal('provider', provider),
                Query.equal('model', model),
                Query.limit(1)
            ]
        );

        // 2. Encrypt API Key if provided
        // If updating and apiKey is empty/masked, we typically keep existing. 
        // But for upsert logic, if user leaves key empty on a NEW doc, that's an error.
        // If updating an existing doc and key is empty, skip update of key.
        const isUpdate = existingDocs.documents.length > 0;
        let finalApiKey = null;

        if (apiKey && apiKey !== '********') {
            finalApiKey = encryption ? encryption.encrypt(apiKey) : apiKey;
        }

        if (!isUpdate && !finalApiKey) {
            return res.status(400).json({ message: 'API Key is required for new configurations' });
        }

        let targetDocId = null;

        // 3. Upsert Logic
        if (isUpdate) {
            targetDocId = existingDocs.documents[0].$id;
            const updatePayload = { isActive: true }; // Activates it
            if (finalApiKey) {
                updatePayload.encryptedApiKey = finalApiKey;
                // Reset health on key update
                updatePayload.healthStatus = 'ok';
                updatePayload.lastError = '';
            }
            // Always update baseUrl if provided (or strictly if present in body)
            // But usually we just update what's changed. 
            // Since we're upserting configurations, we update the Base URL.
            if (provider === 'custom' || provider === 'openai') {
                updatePayload.baseUrl = baseUrl || null;
            }

            await awDatabases.updateDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
                targetDocId,
                updatePayload
            );
        } else {
            const newDoc = await awDatabases.createDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
                ID.unique(),
                {
                    provider,
                    model,
                    encryptedApiKey: finalApiKey,
                    baseUrl: baseUrl || null,
                    isActive: true,
                    healthStatus: 'ok',
                    lastError: ''
                }
            );
            targetDocId = newDoc.$id;
        }

        // 4. Deactivate others
        // We can't do "update all where ID != target" easily.
        // So we list all active ones and flip them.
        const activeDocs = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            [Query.equal('isActive', true)]
        );

        await Promise.all(activeDocs.documents.map(doc => {
            if (doc.$id !== targetDocId) {
                return awDatabases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
                    doc.$id,
                    { isActive: false }
                );
            }
        }));

        // 5. Invalidate Cache


        res.json({ message: 'Configuration saved and activated', activeId: targetDocId });

    } catch (error) {
        console.error('Error upserting LLM config:', error);
        res.status(500).json({ message: 'Failed to save configuration', error: error.message });
    }
};

/**
 * PATCH /api/admin/llm-config/:id/activate
 * Switches active provider
 */
const activateConfig = async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'ID required' });

    try {
        // Check if doc exists
        await awDatabases.getDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            id
        );

        // Deactivate all
        const activeDocs = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            [Query.equal('isActive', true)]
        );

        await Promise.all(activeDocs.documents.map(doc =>
            awDatabases.updateDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
                doc.$id,
                { isActive: false }
            )
        ));

        // Activate target
        await awDatabases.updateDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            id,
            { isActive: true }
        );


        res.json({ message: 'Switched active provider successfully' });

    } catch (error) {
        console.error('Error activating config:', error);
        res.status(500).json({ message: 'Failed to switch provider' });
    }
};

/**
 * DELETE /api/admin/llm-config/:id
 */
const deleteConfig = async (req, res) => {
    const { id } = req.params;
    try {
        // Prevent deleting the ACTIVE one? Or allow and fallback?
        // Let's block deleting the active one for safety.
        const doc = await awDatabases.getDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            id
        );

        if (doc.isActive) {
            return res.status(400).json({ message: 'Cannot delete the currently active configuration. Switch to another one first.' });
        }

        await awDatabases.deleteDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            id
        );

        res.json({ message: 'Configuration deleted' });
    } catch (error) {
        console.error('Error deleting config:', error);
        res.status(500).json({ message: 'Failed to delete configuration' });
    }
};

/**
 * PATCH /api/admin/llm-config/:id
 * Updates API key only (Partial Update)
 * Resets health status. Does NOT change active status.
 */
const updateConfigKey = async (req, res) => {
    const { id } = req.params;
    const { apiKey } = req.body;

    if (!id || !apiKey) {
        return res.status(400).json({ message: 'ID and API Key are required' });
    }

    try {
        let finalApiKey = apiKey;
        if (encryption) {
            finalApiKey = encryption.encrypt(apiKey);
        }

        await awDatabases.updateDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
            id,
            {
                encryptedApiKey: finalApiKey,
                healthStatus: 'ok', // Heal the model
                lastError: ''
            }
        );


        res.json({ message: 'API Key updated and health status reset' });

    } catch (error) {
        console.error('Error updating config key:', error);
        res.status(500).json({ message: 'Failed to update API key' });
    }
};

const settingsService = require('../services/settingsService');

/**
 * GET /api/admin/system-prompt
 * Fetches the global system prompt
 */
const getSystemPrompt = async (req, res) => {
    try {
        const prompt = await settingsService.getSystemPrompt();
        res.json({ systemPrompt: prompt });
    } catch (error) {
        console.error('Error fetching system prompt:', error);
        res.status(500).json({ message: 'Failed to fetch system prompt' });
    }
};

/**
 * POST /api/admin/system-prompt
 * Updates the global system prompt
 */
const saveSystemPrompt = async (req, res) => {
    const { systemPrompt } = req.body;

    if (systemPrompt === undefined) {
        return res.status(400).json({ message: 'systemPrompt is required' });
    }

    try {
        await settingsService.saveSystemPrompt(systemPrompt);
        // Note: We might want to invalidate LLM cache if we cached prompt there, 
        // but current implementation fetches per request or relies on service.
        // settingsService fetches live mostly or we can add caching later.

        res.json({ message: 'System prompt updated successfully' });
    } catch (error) {
        console.error('Error saving system prompt:', error);
        res.status(500).json({ message: 'Failed to save system prompt' });
    }
};

/**
 * GET /api/admin/context-limit
 * Fetches the context limit setting
 */
const getContextLimit = async (req, res) => {
    try {
        const limit = await settingsService.getContextLimit();
        res.json({ limit });
    } catch (error) {
        console.error('Error fetching context limit:', error);
        res.status(500).json({ message: 'Failed to fetch context limit' });
    }
};

/**
 * POST /api/admin/context-limit
 * Updates the context limit setting
 */
const saveContextLimit = async (req, res) => {
    const { limit } = req.body;

    try {
        await settingsService.saveContextLimit(limit);

        // Invalidate LLM cache if relevant


        res.json({ message: 'Context limit updated successfully' });
    } catch (error) {
        console.error('Error saving context limit:', error);
        res.status(400).json({ message: error.message || 'Failed to save context limit' });
    }
};

/**
 * GET /api/admin/welcome-message
 * Fetches the global welcome message
 */
const getWelcomeMessage = async (req, res) => {
    try {
        const message = await settingsService.getWelcomeMessage();
        res.json({ welcomeMessage: message });
    } catch (error) {
        console.error('Error fetching welcome message:', error);
        res.status(500).json({ message: 'Failed to fetch welcome message' });
    }
};

/**
 * POST /api/admin/welcome-message
 * Updates the global welcome message
 */
const saveWelcomeMessage = async (req, res) => {
    const { welcomeMessage } = req.body;

    if (welcomeMessage === undefined) {
        return res.status(400).json({ message: 'welcomeMessage is required' });
    }

    try {
        await settingsService.saveWelcomeMessage(welcomeMessage);
        res.json({ message: 'Welcome message updated successfully' });
    } catch (error) {
        console.error('Error saving welcome message:', error);
        res.status(500).json({ message: 'Failed to save welcome message' });
    }
};

/**
 * GET /api/admin/image-prompt
 * Fetches the global image analysis prompt
 */
const getImagePrompt = async (req, res) => {
    try {
        const prompt = await settingsService.getImageAnalysisPrompt();
        res.json({ imagePrompt: prompt });
    } catch (error) {
        console.error('Error fetching image prompt:', error);
        res.status(500).json({ message: 'Failed to fetch image prompt' });
    }
};

/**
 * POST /api/admin/image-prompt
 * Updates the global image analysis prompt
 */
const saveImagePrompt = async (req, res) => {
    const { imagePrompt } = req.body;

    if (imagePrompt === undefined) {
        return res.status(400).json({ message: 'imagePrompt is required' });
    }

    try {
        await settingsService.saveImageAnalysisPrompt(imagePrompt);
        res.json({ message: 'Image prompt updated successfully' });
    } catch (error) {
        console.error('Error saving image prompt:', error);
        res.status(500).json({ message: 'Failed to save image prompt' });
    }
};

// AI Config functions removed (Unified Fleet Architecture)

module.exports = {
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
};
