const {
    awDatabases,
    Query,
    config
} = require('../config/clients');

const {
    APPWRITE_DATABASE_ID,
} = config;

const APPWRITE_CANNED_RESPONSES_COLLECTION_ID = 'canned_responses';
const responseService = require('../services/chat/responseService');

// Get Canned Responses
const getCannedResponses = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        const { type } = req.query; // 'shortcut', 'auto_reply', or undefined (all)

        let queries = [];

        // Filter by type if provided
        if (type === 'shortcut') {
            // Shortcuts: match_type is 'shortcut' or null/missing
            if (Query) {
                // Note: Appwrite Query.or doesn't work as expected, so we filter manually after fetch
                queries.push(Query.orderDesc('$createdAt'));
            }
        } else if (type === 'auto_reply') {
            // Auto-replies: match_type is 'exact', 'partial', or 'keyword'
            if (Query) {
                queries.push(Query.orderDesc('$createdAt'));
            }
        } else {
            // No type filter - return all
            if (Query) {
                queries.push(Query.orderDesc('$createdAt'));
            }
        }

        let result;
        try {
            result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
                queries.length > 0 ? queries : undefined,
                1000
            );

            // Filter by type manually (Appwrite Query.or limitations)
            if (type === 'shortcut') {
                result.documents = result.documents.filter(doc =>
                    !doc.match_type || doc.match_type === 'shortcut'
                );
            } else if (type === 'auto_reply') {
                result.documents = result.documents.filter(doc =>
                    ['exact', 'partial', 'keyword'].includes(doc.match_type)
                );
            }

            // Sort by creation date if Query not available
            if (!Query) {
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
            total: result.documents.length
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

        const { shortcut, category, content, match_type, is_active } = req.body;

        if (!shortcut || !content) return res.status(400).json({ error: 'Shortcut and content are required' });

        const matchType = match_type || 'shortcut';
        const isActive = is_active !== undefined ? is_active : true;

        // Normalize shortcut based on match_type
        let normalizedShortcut;
        if (matchType === 'shortcut') {
            // Shortcuts: no spaces, lowercase
            normalizedShortcut = shortcut.toLowerCase().replace(/\s+/g, '');
        } else {
            // Auto-replies: allow spaces, but lowercase
            normalizedShortcut = shortcut.toLowerCase().trim();
        }

        if (!normalizedShortcut) return res.status(400).json({ error: 'Shortcut cannot be empty' });
        if (content.length > 5000) return res.status(400).json({ error: 'Content cannot exceed 5000 characters' });

        const { ID } = require('node-appwrite');
        const responseId = ID.unique();

        const responseData = {
            shortcut: normalizedShortcut,
            category: category || null,
            content: content.trim(),
            match_type: matchType,
            is_active: isActive
        };

        try {
            const result = await awDatabases.createDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
                responseId,
                responseData
            );
            console.log(`✅ Canned response created: ${normalizedShortcut} (${matchType})`);

            // Refresh cache if it's an auto-reply
            if (['exact', 'partial', 'keyword'].includes(matchType)) {
                await responseService.refreshCache();
            }

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
        const { shortcut, category, content, match_type, is_active } = req.body;

        if (!shortcut || !content) return res.status(400).json({ error: 'Shortcut and content are required' });

        const matchType = match_type || 'shortcut';
        const isActive = is_active !== undefined ? is_active : true;

        // Normalize shortcut based on match_type
        let normalizedShortcut;
        if (matchType === 'shortcut') {
            // Shortcuts: no spaces, lowercase
            normalizedShortcut = shortcut.toLowerCase().replace(/\s+/g, '');
        } else {
            // Auto-replies: allow spaces, but lowercase
            normalizedShortcut = shortcut.toLowerCase().trim();
        }

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
            content: content.trim(),
            match_type: matchType,
            is_active: isActive
        };

        const result = await awDatabases.updateDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
            id,
            updateData
        );

        console.log(`✅ Canned response updated: ${normalizedShortcut} (${matchType})`);

        // Refresh cache if it's an auto-reply
        if (['exact', 'partial', 'keyword'].includes(matchType)) {
            await responseService.refreshCache();
        }

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

        // Get the document first to check if it's an auto-reply
        let wasAutoReply = false;
        try {
            const doc = await awDatabases.getDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
                id
            );
            wasAutoReply = ['exact', 'partial', 'keyword'].includes(doc.match_type);
        } catch (e) { }

        await awDatabases.deleteDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
            id
        );

        console.log(`✅ Canned response deleted: ${id}`);

        // Refresh cache if it was an auto-reply
        if (wasAutoReply) {
            await responseService.refreshCache();
        }

        res.json({ success: true, message: 'Canned response deleted successfully' });
    } catch (err) {
        console.error('Error deleting canned response:', err);
        if (err.code === 404) return res.status(404).json({ error: 'Canned response not found' });
        res.status(500).json({ error: err?.message || 'Failed to delete canned response' });
    }
};

// Refresh Response Cache
const refreshResponseCache = async (req, res) => {
    try {
        await responseService.refreshCache();
        const stats = responseService.getCacheStats();
        res.json({
            success: true,
            message: 'Response cache refreshed successfully',
            stats
        });
    } catch (err) {
        console.error('Error refreshing response cache:', err);
        res.status(500).json({ error: err?.message || 'Failed to refresh response cache' });
    }
};

module.exports = {
    getCannedResponses,
    createCannedResponse,
    updateCannedResponse,
    deleteCannedResponse,
    refreshResponseCache
};
