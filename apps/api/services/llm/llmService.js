const {
    awDatabases,
    config,
    encryption
} = require('../../config/clients'); // Adjust path as needed

const {
    APPWRITE_DATABASE_ID,
    APPWRITE_LLM_SETTINGS_COLLECTION_ID
} = config;

// Optional: In-memory cache for the active provider instance
let activeProviderInstance = null;
let activeProviderConfig = null;

async function getActiveProvider() {
    // If we have an active instance, we could return it, but we need a way to invalidate it when settings change.
    // For now, let's fetch the config to check if it matches our cached version.
    // Optimization: In high load, implement a webhook or polling or finding a way to signal update. 
    // For this chat app, fetching the document is relatively cheap if we index 'isActive'.

    try {
        const { Query } = require('node-appwrite');
        const result = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings', // Default if not in env yet
            [Query.equal('isActive', true), Query.limit(1)]
        );

        if (result.documents.length === 0) {
            console.warn('⚠️ No active LLM provider found. Falling back to default Gemini from env.');
            // Fallback to env variable Gemini if specific config is missing
            const GeminiProvider = require('./providers/gemini');
            return new GeminiProvider(process.env.GEMINI_API_KEY, 'gemini-1.5-flash');
        }

        const doc = result.documents[0];

        // Check if we can reuse the cached instance
        if (activeProviderInstance && activeProviderConfig && activeProviderConfig.$id === doc.$id && activeProviderConfig.updatedAt === doc.$updatedAt) {
            return activeProviderInstance;
        }

        console.log(`🔄 Switching LLM Provider to: ${doc.provider} (${doc.model})`);

        // Decrypt API Key
        let apiKey = doc.encryptedApiKey;
        if (encryption && doc.encryptedApiKey) {
            try {
                apiKey = encryption.decrypt(doc.encryptedApiKey);
            } catch (e) {
                console.error('Failed to decrypt LLM API Key:', e);
                throw new Error('Invalid API Key Encryption');
            }
        } else {
            // If not encrypted (legacy or direct), use as is 
            apiKey = doc.apiKey || doc.encryptedApiKey;
        }

        let providerInstance;
        switch (doc.provider) {
            case 'openai':
                const OpenAIProvider = require('./providers/openai');
                providerInstance = new OpenAIProvider(apiKey, doc.model);
                break;
            case 'anthropic':
                const AnthropicProvider = require('./providers/anthropic');
                providerInstance = new AnthropicProvider(apiKey, doc.model);
                break;
            case 'google':
            default:
                const GeminiProvider = require('./providers/gemini');
                providerInstance = new GeminiProvider(apiKey, doc.model);
                break;
        }

        // Update Cache
        activeProviderInstance = providerInstance;
        activeProviderConfig = { $id: doc.$id, updatedAt: doc.$updatedAt, provider: doc.provider || 'gemini' };

        return providerInstance;

    } catch (error) {
        console.error('Error in LLM Service Factory:', error);
        // Fallback
        const GeminiProvider = require('./providers/gemini');
        return new GeminiProvider(process.env.GEMINI_API_KEY);
    }
}

const settingsService = require('../settingsService');

/**
 * Generate a response using the active LLM provider.
 * @param {Array} messages - Array of { role, content } objects.
 * @returns {Promise<string>} The generated text.
 */
async function generateResponse(messages) {
    try {
        const provider = await getActiveProvider();

        // Fetch system prompt (fails safe with default)
        const systemPrompt = await settingsService.getSystemPrompt();

        return await provider.generateResponse(messages, systemPrompt);
    } catch (error) {
        console.error('❌ LLM Generation Failed:', error);

        // Analyze error
        let status = 'error';
        let severity = 'error';
        let alertTitle = 'AI Service Error';
        let alertMessage = 'Service disruption detected.';

        // Detect Auth Errors (401/403 or specific strings)
        // Gemini throws GoogleGenerativeAIError usually, checking message is safest fallback
        const errMsg = error.message || '';
        if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API key') || errMsg.includes('unauthorized') || errMsg.includes('permission denied')) {
            status = 'error';
            severity = 'critical';
            alertTitle = 'AI Critical Failure';
            alertMessage = 'API Key is invalid or expired. AI is currently offline.';
        }
        // Rate Limits
        else if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests')) {
            status = 'warning';
            severity = 'warning';
            alertTitle = 'AI Rate Limit Warning';
            alertMessage = 'LLM Rate limits reached. Service may be intermittent.';
        }

        // 1. Trigger Notification
        try {
            const { broadcastSystemAlert } = require('../notificationService');
            // Only broadcast if it's critical or warning, or if it's a hard crash? 
            // User requested alerts for these cases.
            // Target admins for all, agents for general disruptions?
            // "If Auth Error ... ['admin']. If General Error ... ['admin', 'agent']"

            const targetRoles = severity === 'critical' ? ['admin'] : ['admin', 'agent'];
            await broadcastSystemAlert(alertTitle, alertMessage, severity, targetRoles);
        } catch (notifyErr) {
            console.error('Failed to send system alert:', notifyErr);
        }

        // 2. Update DB with health status
        // We need the ID of the active config. `activeProviderConfig` stores it.
        // Warning: activeProviderConfig might be null if getActiveProvider failed completely (e.g. DB error)
        try {
            if (activeProviderConfig && activeProviderConfig.$id) {
                await awDatabases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
                    activeProviderConfig.$id,
                    {
                        healthStatus: status,
                        lastError: errMsg.substring(0, 255) // Truncate for safety
                    }
                );
                console.log(`📝 Updated LLM Settings healthStatus to: ${status}`);
            }
        } catch (dbErr) {
            console.error('Failed to update LLM health status in DB:', dbErr);
        }

        throw error; // Re-throw so chatService knows it failed
    }
}

/**
 * Clear the cache to force a refresh (e.g. after settings update)
 */
function invalidateCache() {
    activeProviderInstance = null;
    activeProviderConfig = null;
}

/**
 * Get current provider info (name and model)
 * @returns {Promise<Object>} The provider info object
 */
async function getCurrentProviderInfo() {
    try {
        await getActiveProvider(); // Ensure cache is warm

        let providerName = 'Gemini'; // Default
        let modelName = 'gemini-1.5-flash';

        if (activeProviderConfig) {
            // If we saved provider in config, use it. But we didn't update getActiveProvider yet.
            // Let's rely on checking the instance type or just fetching activeProviderConfig if we update getActiveProvider to save it. 
            // To be safe and simple, let's just re-fetch or assume Gemini if undefined, 
            // but actually getActiveProvider fetches the doc.
            // Let's update getActiveProvider to save 'provider' to activeProviderConfig first.
            if (activeProviderConfig.provider) {
                providerName = activeProviderConfig.provider.charAt(0).toUpperCase() + activeProviderConfig.provider.slice(1);
            }
        }

        return {
            name: providerName,
            model: activeProviderConfig?.model || modelName
        };
    } catch (error) {
        return { name: 'Gemini', model: 'default' };
    }
}

module.exports = {
    getActiveProvider,
    generateResponse,
    invalidateCache,
    getCurrentProviderInfo
};
