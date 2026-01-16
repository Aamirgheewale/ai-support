const {
    awDatabases,
    Query,
    config
} = require('../config/clients');

const {
    APPWRITE_DATABASE_ID,
} = config;

const APPWRITE_CANNED_RESPONSES_COLLECTION_ID = 'canned_responses';

// Get Canned Responses
const getCannedResponses = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        let result;
        try {
            if (Query) {
                result = await awDatabases.listDocuments(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
                    [Query.orderDesc('$createdAt')],
                    1000
                );
            } else {
                result = await awDatabases.listDocuments(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
                    undefined,
                    1000
                );
                result.documents.sort((a, b) => {
                    const dateA = new Date(a.$createdAt || a.createdAt || 0).getTime();
                    const dateB = new Date(b.$createdAt || b.createdAt || 0).getTime();
                    return dateB - dateA;
                });
            }
        } catch (err) {
            console.error('Error fetching canned responses:', err);
            return res.status(500).json({ error: 'Failed to fetch canned responses' });
        }

        res.json({
            responses: result.documents,
            total: result.total || result.documents.length
        });
    } catch (err) {
        console.error('Error fetching canned responses:', err);
        res.status(500).json({ error: 'Failed to fetch canned responses' });
    }
};

// Create Canned Response
const createCannedResponse = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        const { shortcut, category, content } = req.body;

        if (!shortcut || !content) return res.status(400).json({ error: 'Shortcut and content are required' });

        const normalizedShortcut = shortcut.toLowerCase().replace(/\s+/g, '');
        if (!normalizedShortcut) return res.status(400).json({ error: 'Shortcut cannot be empty' });
        if (content.length > 5000) return res.status(400).json({ error: 'Content cannot exceed 5000 characters' });

        const { ID } = require('node-appwrite');
        const responseId = ID.unique();

        const responseData = {
            shortcut: normalizedShortcut,
            category: category || null,
            content: content.trim()
        };

        try {
            const result = await awDatabases.createDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
                responseId,
                responseData
            );
            console.log(`✅ Canned response created: ${normalizedShortcut}`);
            res.json({ success: true, response: result });
        } catch (createErr) {
            if (createErr.code === 409 || createErr.message?.includes('already exists') || createErr.message?.includes('duplicate')) {
                return res.status(409).json({ error: 'Shortcut already exists' });
            }
            throw createErr;
        }
    } catch (err) {
        console.error('Error creating canned response:', err);
        res.status(500).json({ error: err?.message || 'Failed to create canned response' });
    }
};

// Update Canned Response
const updateCannedResponse = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        const { id } = req.params;
        const { shortcut, category, content } = req.body;

        if (!shortcut || !content) return res.status(400).json({ error: 'Shortcut and content are required' });

        const normalizedShortcut = shortcut.toLowerCase().replace(/\s+/g, '');
        if (!normalizedShortcut) return res.status(400).json({ error: 'Shortcut cannot be empty' });
        if (content.length > 5000) return res.status(400).json({ error: 'Content cannot exceed 5000 characters' });

        try {
            if (Query) {
                const existing = await awDatabases.listDocuments(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
                    [Query.equal('shortcut', normalizedShortcut)],
                    1
                );
                if (existing.documents.length > 0 && existing.documents[0].$id !== id) {
                    return res.status(409).json({ error: 'Shortcut already exists' });
                }
            }
        } catch (checkErr) { console.warn('Could not check for duplicate shortcut:', checkErr.message); }

        const updateData = {
            shortcut: normalizedShortcut,
            category: category || null,
            content: content.trim()
        };

        const result = await awDatabases.updateDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
            id,
            updateData
        );

        console.log(`✅ Canned response updated: ${normalizedShortcut}`);
        res.json({ success: true, response: result });
    } catch (err) {
        console.error('Error updating canned response:', err);
        if (err.code === 404) return res.status(404).json({ error: 'Canned response not found' });
        res.status(500).json({ error: err?.message || 'Failed to update canned response' });
    }
};

// Delete Canned Response
const deleteCannedResponse = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        const { id } = req.params;

        await awDatabases.deleteDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
            id
        );

        console.log(`✅ Canned response deleted: ${id}`);
        res.json({ success: true, message: 'Canned response deleted successfully' });
    } catch (err) {
        console.error('Error deleting canned response:', err);
        if (err.code === 404) return res.status(404).json({ error: 'Canned response not found' });
        res.status(500).json({ error: err?.message || 'Failed to delete canned response' });
    }
};

module.exports = {
    getCannedResponses,
    createCannedResponse,
    updateCannedResponse,
    deleteCannedResponse
};
