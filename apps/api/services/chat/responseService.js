/**
 * Response Service - In-Memory Bot Auto-Reply Engine
 * 
 * Handles automatic responses based on user messages.
 * Supports exact match, partial match (starts with), and keyword match.
 */

const {
    awDatabases,
    Query,
    config
} = require('../../config/clients');

const { APPWRITE_DATABASE_ID } = config;
const APPWRITE_CANNED_RESPONSES_COLLECTION_ID = 'canned_responses';

// In-memory cache for active auto-replies
global.responseCache = {
    exact: new Map(),      // Exact matches: normalized message -> content
    partial: [],           // Partial matches: { trigger, content }
    keyword: []            // Keyword matches: { trigger, content }
};

/**
 * Normalize user message for matching
 */
function normalizeMessage(message) {
    if (!message || typeof message !== 'string') return '';
    return message
        .toLowerCase()
        .trim()
        .replace(/[.,!?;:]/g, '')
        .replace(/\s+/g, ' ');
}

/**
 * Load all active auto-replies into memory cache
 */
async function loadResponses() {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            console.warn('⚠️ Appwrite not configured, skipping response cache load');
            return;
        }

        console.log('🔄 Loading bot auto-replies into cache...');

        // Fetch all active auto-replies
        const queries = [
            Query.equal('is_active', true),
            Query.limit(1000)
        ];

        const result = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_CANNED_RESPONSES_COLLECTION_ID,
            queries
        );

        // Clear existing cache
        global.responseCache.exact.clear();
        global.responseCache.partial = [];
        global.responseCache.keyword = [];

        let exactCount = 0;
        let partialCount = 0;
        let keywordCount = 0;

        // Populate cache by match type
        for (const doc of result.documents) {
            const matchType = doc.match_type || 'shortcut';

            // Only process auto-reply types
            if (!['exact', 'partial', 'keyword'].includes(matchType)) {
                continue;
            }

            const trigger = normalizeMessage(doc.shortcut);
            const content = doc.content;

            if (!trigger || !content) continue;

            switch (matchType) {
                case 'exact':
                    global.responseCache.exact.set(trigger, content);
                    exactCount++;
                    break;
                case 'partial':
                    global.responseCache.partial.push({ trigger, content });
                    partialCount++;
                    break;
                case 'keyword':
                    global.responseCache.keyword.push({ trigger, content });
                    keywordCount++;
                    break;
            }
        }

        // Sort partial and keyword by trigger length (longer first for better matching)
        global.responseCache.partial.sort((a, b) => b.trigger.length - a.trigger.length);
        global.responseCache.keyword.sort((a, b) => b.trigger.length - a.trigger.length);

        console.log(`✅ Response cache loaded: ${exactCount} exact, ${partialCount} partial, ${keywordCount} keyword`);
    } catch (err) {
        console.error('❌ Error loading response cache:', err);
    }
}

/**
 * Find matching auto-reply for user message
 * @param {string} userMessage - The user's message
 * @returns {string|null} - Matched response content or null
 */
function findMatch(userMessage) {
    if (!userMessage || typeof userMessage !== 'string') return null;

    const normalized = normalizeMessage(userMessage);
    if (!normalized) return null;

    // 1. Check exact matches first (highest priority)
    if (global.responseCache.exact.has(normalized)) {
        const content = global.responseCache.exact.get(normalized);
        console.log(`🎯 Exact match found for: "${userMessage}"`);
        return content;
    }

    // 2. Check partial matches (starts with)
    for (const { trigger, content } of global.responseCache.partial) {
        if (normalized.startsWith(trigger)) {
            console.log(`🎯 Partial match found for: "${userMessage}" (trigger: "${trigger}")`);
            return content;
        }
    }

    // 3. Check keyword matches (contains)
    for (const { trigger, content } of global.responseCache.keyword) {
        if (normalized.includes(trigger)) {
            console.log(`🎯 Keyword match found for: "${userMessage}" (trigger: "${trigger}")`);
            return content;
        }
    }

    return null;
}

/**
 * Refresh the response cache
 */
async function refreshCache() {
    console.log('🔄 Refreshing response cache...');
    await loadResponses();
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    return {
        exact: global.responseCache.exact.size,
        partial: global.responseCache.partial.length,
        keyword: global.responseCache.keyword.length,
        total: global.responseCache.exact.size +
            global.responseCache.partial.length +
            global.responseCache.keyword.length
    };
}

module.exports = {
    loadResponses,
    findMatch,
    refreshCache,
    getCacheStats
};
