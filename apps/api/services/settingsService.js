const { awDatabases, Query, config } = require('../config/clients');
const { APPWRITE_DATABASE_ID } = config;

// Collection ID for general app settings
// Using 'app_settings' as the ID based on user instruction
const APPWRITE_APP_SETTINGS_COLLECTION_ID = 'app_settings';

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";
const DEFAULT_WELCOME_MESSAGE = "Hi! I'm your AI Assistant. How can I help you today?";
const DEFAULT_IMAGE_ANALYSIS_PROMPT = "Analyze this image and provide a helpful response in the context of our support query.";

/**
 * Service to manage global application settings
 */
const settingsService = {

    /**
     * Fetch the global system prompt.
     * Returns a default value if not found or on error.
     * @returns {Promise<string>}
     */
    async getSystemPrompt() {
        if (!awDatabases) {
            console.warn('⚠️ Appwrite DB not ready, using default system prompt');
            return DEFAULT_SYSTEM_PROMPT;
        }

        try {
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_APP_SETTINGS_COLLECTION_ID,
                [
                    Query.equal('key', 'system_prompt'),
                    Query.limit(1)
                ]
            );

            if (result.documents.length > 0) {
                return result.documents[0].value;
            } else {
                return DEFAULT_SYSTEM_PROMPT;
            }
        } catch (error) {
            // Log error but fallback gracefully to ensure chat continuity
            console.warn(`⚠️ Failed to fetch system prompt (using default): ${error.message}`);
            return DEFAULT_SYSTEM_PROMPT;
        }
    },

    /**
     * Update or create the global system prompt.
     * @param {string} text 
     * @returns {Promise<Object>} The document
     */
    async saveSystemPrompt(text) {
        if (!awDatabases) throw new Error('Database connection not available');

        try {
            // 1. Check if it exists
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_APP_SETTINGS_COLLECTION_ID,
                [
                    Query.equal('key', 'system_prompt'),
                    Query.limit(1)
                ]
            );

            if (result.documents.length > 0) {
                // 2. Update existing
                const docId = result.documents[0].$id;
                return await awDatabases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_APP_SETTINGS_COLLECTION_ID,
                    docId,
                    { value: text }
                );
            } else {
                // 3. Create new
                // We need 'node-appwrite' ID generator, but it's not exported by clients.js
                // We can use 'unique()' string for ID which client handles, 
                // but checking clients.js, it doesn't export ID. 
                // Usually 'unique()' (string) works as document ID argument for CreateDocument in newer SDKs
                // or we try to require it if available in node_modules

                return await awDatabases.createDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_APP_SETTINGS_COLLECTION_ID,
                    'unique()',
                    {
                        key: 'system_prompt',
                        value: text
                    }
                );
            }
        } catch (error) {
            console.error('❌ Error saving system prompt:', error);
            throw error;
        }
    },

    /**
     * Get the configured context limit (number of messages).
     * Defaults to 10 if not set.
     * @returns {Promise<number>}
     */
    async getContextLimit() {
        if (!awDatabases) return 10;

        try {
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_APP_SETTINGS_COLLECTION_ID,
                [
                    Query.equal('key', 'context_limit'),
                    Query.limit(1)
                ]
            );

            if (result.documents.length > 0) {
                const val = parseInt(result.documents[0].value, 10);
                return isNaN(val) ? 10 : val;
            }
            return 10;
        } catch (error) {
            console.warn(`⚠️ Failed to fetch context limit (using default): ${error.message}`);
            return 10;
        }
    },

    /**
     * Save the context limit.
     * @param {number} limit - Between 2 and 50.
     * @returns {Promise<Object>}
     */
    async saveContextLimit(limit) {
        // Validate input
        const num = parseInt(limit, 10);
        if (isNaN(num) || num < 2 || num > 50) {
            throw new Error('Context limit must be between 2 and 50');
        }

        if (!awDatabases) throw new Error('Database connection not available');

        try {
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_APP_SETTINGS_COLLECTION_ID,
                [
                    Query.equal('key', 'context_limit'),
                    Query.limit(1)
                ]
            );

            const valueStr = String(num);

            if (result.documents.length > 0) {
                const docId = result.documents[0].$id;
                return await awDatabases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_APP_SETTINGS_COLLECTION_ID,
                    docId,
                    { value: valueStr }
                );
            } else {
                return await awDatabases.createDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_APP_SETTINGS_COLLECTION_ID,
                    'unique()',
                    {
                        key: 'context_limit',
                        value: valueStr
                    }
                );
            }
        } catch (error) {
            console.error('❌ Error saving context limit:', error);
            throw error;
        }
    },

    /**
     * Fetch the global welcome message.
     * Returns a default value if not found or on error.
     * @returns {Promise<string>}
     */
    async getWelcomeMessage() {
        if (!awDatabases) {
            console.warn('⚠️ Appwrite DB not ready, using default welcome message');
            return DEFAULT_WELCOME_MESSAGE;
        }

        try {
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_APP_SETTINGS_COLLECTION_ID,
                [
                    Query.equal('key', 'welcome_message'),
                    Query.limit(1)
                ]
            );

            if (result.documents.length > 0) {
                return result.documents[0].value;
            } else {
                return DEFAULT_WELCOME_MESSAGE;
            }
        } catch (error) {
            // Log error but fallback gracefully to ensure chat continuity
            console.warn(`⚠️ Failed to fetch welcome message (using default): ${error.message}`);
            return DEFAULT_WELCOME_MESSAGE;
        }
    },

    /**
     * Update or create the global welcome message.
     * @param {string} text 
     * @returns {Promise<Object>} The document
     */
    async saveWelcomeMessage(text) {
        if (!awDatabases) throw new Error('Database connection not available');

        try {
            // 1. Check if it exists
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_APP_SETTINGS_COLLECTION_ID,
                [
                    Query.equal('key', 'welcome_message'),
                    Query.limit(1)
                ]
            );

            if (result.documents.length > 0) {
                // 2. Update existing
                const docId = result.documents[0].$id;
                return await awDatabases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_APP_SETTINGS_COLLECTION_ID,
                    docId,
                    { value: text }
                );
            } else {
                // 3. Create new
                return await awDatabases.createDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_APP_SETTINGS_COLLECTION_ID,
                    'unique()',
                    {
                        key: 'welcome_message',
                        value: text
                    }
                );
            }
        } catch (error) {
            console.error('❌ Error saving welcome message:', error);
            throw error;
        }
    },

    /**
     * Fetch the image analysis prompt for vision/multimodal LLM.
     * Returns a default value if not found or on error.
     * @returns {Promise<string>}
     */
    async getImageAnalysisPrompt() {
        if (!awDatabases) {
            console.warn('⚠️ Appwrite DB not ready, using default image analysis prompt');
            return DEFAULT_IMAGE_ANALYSIS_PROMPT;
        }

        try {
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_APP_SETTINGS_COLLECTION_ID,
                [
                    Query.equal('key', 'image_analysis_prompt'),
                    Query.limit(1)
                ]
            );

            if (result.documents.length > 0) {
                return result.documents[0].value;
            } else {
                return DEFAULT_IMAGE_ANALYSIS_PROMPT;
            }
        } catch (error) {
            console.warn(`⚠️ Failed to fetch image analysis prompt (using default): ${error.message}`);
            return DEFAULT_IMAGE_ANALYSIS_PROMPT;
        }
    },

    /**
     * Save/update the image analysis prompt.
     * @param {string} text - The new image analysis prompt
     * @returns {Promise<Object>} The created/updated document
     */
    async saveImageAnalysisPrompt(text) {
        if (!awDatabases) throw new Error('Database connection not available');

        try {
            // 1. Check if exists
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_APP_SETTINGS_COLLECTION_ID,
                [
                    Query.equal('key', 'image_analysis_prompt'),
                    Query.limit(1)
                ]
            );

            if (result.documents.length > 0) {
                // 2. Update existing
                const docId = result.documents[0].$id;
                return await awDatabases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_APP_SETTINGS_COLLECTION_ID,
                    docId,
                    { value: text }
                );
            } else {
                // 3. Create new
                return await awDatabases.createDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_APP_SETTINGS_COLLECTION_ID,
                    'unique()',
                    {
                        key: 'image_analysis_prompt',
                        value: text
                    }
                );
            }
        } catch (error) {
            console.error('❌ Error saving image analysis prompt:', error);
            throw error;
        }
    }
};

module.exports = settingsService;
