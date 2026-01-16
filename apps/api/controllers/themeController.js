const {
    awDatabases,
    config
} = require('../config/clients');

const {
    APPWRITE_DATABASE_ID,
    APPWRITE_SESSIONS_COLLECTION_ID
} = config;

// Update Session Theme
const updateSessionTheme = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { themeVars } = req.body;

        if (!themeVars) {
            return res.status(400).json({ error: 'themeVars required' });
        }

        if (awDatabases && APPWRITE_DATABASE_ID && APPWRITE_SESSIONS_COLLECTION_ID) {
            await awDatabases.updateDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_SESSIONS_COLLECTION_ID,
                sessionId,
                { theme: typeof themeVars === 'object' ? JSON.stringify(themeVars) : themeVars }
            );
        }

        res.json({ success: true, sessionId, theme: themeVars });
    } catch (err) {
        console.error('Error updating theme:', err);
        res.status(500).json({ error: err?.message || 'Failed to update theme' });
    }
};

// Get Session Theme
const getSessionTheme = async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
            return res.json({ theme: {} });
        }

        const doc = await awDatabases.getDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_SESSIONS_COLLECTION_ID,
            sessionId
        );

        res.json({ theme: doc.theme || {} });
    } catch (err) {
        if (err.code === 404) {
            return res.json({ theme: {} });
        }
        console.error('Error getting theme:', err);
        res.status(500).json({ error: err?.message || 'Failed to get theme' });
    }
};

module.exports = {
    updateSessionTheme,
    getSessionTheme
};
