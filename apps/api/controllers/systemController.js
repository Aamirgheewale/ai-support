const {
    awDatabases,
    Query,
    encryption,
    config
} = require('../config/clients');

const {
    APPWRITE_DATABASE_ID,
    APPWRITE_USERS_COLLECTION_ID,
    APPWRITE_AI_ACCURACY_COLLECTION_ID,
    APPWRITE_ACCURACY_AUDIT_COLLECTION_ID,
    ACCURACY_MAX_SCAN_ROWS,
    APPWRITE_ENCRYPTION_AUDIT_COLLECTION_ID,
    APPWRITE_MESSAGES_COLLECTION_ID,
    APPWRITE_SESSIONS_COLLECTION_ID,
    APPWRITE_NOTIFICATIONS_COLLECTION_ID,
    MASTER_KEY_BASE64,
    ENCRYPTION_ENABLED,
    REDACT_PII,
    APPWRITE_ENDPOINT,
    APPWRITE_PROJECT_ID,
    APPWRITE_API_KEY
} = config;

// Encryption Helper
async function logEncryptionAction(action, adminId, stats = {}) {
    if (!awDatabases || !APPWRITE_DATABASE_ID) {
        return;
    }

    try {
        await awDatabases.createDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_ENCRYPTION_AUDIT_COLLECTION_ID || 'encryption_audit',
            'unique()',
            {
                action,
                adminId: adminId || 'system',
                stats: typeof stats === 'object' ? JSON.stringify(stats) : stats,
                ts: new Date().toISOString()
            }
        );
    } catch (err) {
        // Ignore errors (collection might not exist)
        console.warn('Failed to log encryption action:', err.message);
    }
}

const { LRUCache } = require('lru-cache');

// In-memory cache for accuracy stats (TTL 60s)
const accuracyStatsCache = new LRUCache({
    max: 100,
    ttl: 60000 // 60 seconds
});

// Pagination helpers
const { parsePaginationParams, validatePaginationParams, calculatePaginationMeta } = require('../lib/parsePaginationParams');

// ============================================================================
// IMAGE PROXY
// ============================================================================

// GET /api/proxy/image
const proxyImage = async (req, res) => {
    try {
        const { url } = req.query;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        const decodedUrl = decodeURIComponent(url);
        const allowedHosts = ['fra.cloud.appwrite.io', 'cloud.appwrite.io', 'appwrite.io'];

        try {
            const urlObj = new URL(decodedUrl);
            if (!allowedHosts.some(host => urlObj.hostname.endsWith(host))) {
                console.warn(`⚠️  Blocked proxy request to non-Appwrite URL: ${urlObj.hostname}`);
                return res.status(403).json({ error: 'Only Appwrite storage URLs are allowed' });
            }
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        const response = await fetch(decodedUrl);

        if (!response.ok) {
            console.error(`❌ Image proxy failed: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type') || 'image/png';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));

        console.log(`📷 Proxied image: ${decodedUrl.substring(0, 80)}...`);
    } catch (err) {
        console.error('Error proxying image:', err);
        res.status(500).json({ error: err?.message || 'Failed to proxy image' });
    }
};

// ============================================================================
// ACCURACY LOGGING
// ============================================================================

// GET /admin/accuracy
const getAccuracyRecords = async (req, res) => {
    try {
        try {
            validatePaginationParams(req);
        } catch (validationErr) {
            return res.status(400).json({ error: validationErr.message });
        }

        const { limit, offset } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });

        if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
            return res.json({ items: [], total: 0, limit, offset, hasMore: false, error: 'Appwrite not configured' });
        }

        const { sessionId, from, to, mark, sortBy = 'createdAt', order = 'desc' } = req.query;
        const queries = [];

        if (sessionId) queries.push(Query.equal('sessionId', sessionId));
        if (from || to) {
            const fromDate = from ? new Date(from) : new Date(0);
            const toDate = to ? new Date(to) : new Date();
            queries.push(Query.between('createdAt', fromDate.toISOString(), toDate.toISOString()));
        }
        if (mark) queries.push(Query.equal('humanMark', mark));

        if (sortBy === 'createdAt') {
            if (order === 'desc') queries.push(Query.orderDesc('createdAt'));
            else queries.push(Query.orderAsc('createdAt'));
        }

        console.log(`📋 Fetching accuracy records: limit=${limit}, offset=${offset}, filters: sessionId=${sessionId || 'none'}`);

        const result = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_AI_ACCURACY_COLLECTION_ID,
            queries,
            limit,
            offset
        );

        const paginationMeta = calculatePaginationMeta(result.total, limit, offset);

        res.json({
            items: result.documents,
            records: result.documents,
            total: result.total,
            limit,
            offset,
            hasMore: paginationMeta.hasMore,
            currentPage: paginationMeta.currentPage,
            totalPages: paginationMeta.totalPages
        });
    } catch (err) {
        console.error('Error listing accuracy records:', err);
        res.status(500).json({ error: err?.message || 'Failed to list accuracy records' });
    }
};

// GET /admin/accuracy/stats
const getAccuracyStats = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        const { from, to } = req.query;
        // Include sort order in cache key to avoid mixing sorted/unsorted if we ever change it back (good practice)
        const cacheKey = `stats_v2_${from || 'all'}_${to || 'all'}`;

        if (accuracyStatsCache.has(cacheKey)) {
            return res.json(accuracyStatsCache.get(cacheKey));
        }

        const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();

        const queries = [
            Query.between('createdAt', fromDate.toISOString(), toDate.toISOString()),
            Query.orderDesc('createdAt') // Scan newest first
        ];

        let totalScanned = 0;
        let totalResponses = 0;
        let totalConfidence = 0;
        let confidenceCount = 0;
        let totalLatency = 0;
        let latencyCount = 0;

        let helpfulCount = 0;
        let unhelpfulCount = 0;
        let flaggedCount = 0;

        let hasMore = true;
        let offset = 0;
        const pageSize = 100;

        while (hasMore && totalScanned < ACCURACY_MAX_SCAN_ROWS) {
            const pageQueries = [...queries, Query.limit(pageSize), Query.offset(offset)];
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_AI_ACCURACY_COLLECTION_ID,
                pageQueries
            );

            for (const doc of result.documents) {
                totalScanned++;
                totalResponses++;

                // Only count valid confidence scores
                if (doc.confidence !== null && doc.confidence !== undefined) {
                    totalConfidence += doc.confidence;
                    confidenceCount++;
                }

                // Only count valid latency
                if (doc.latencyMs !== null && doc.latencyMs !== undefined) {
                    totalLatency += doc.latencyMs;
                    latencyCount++;
                }

                if (doc.humanMark === 'helpful') helpfulCount++;
                else if (doc.humanMark === 'unhelpful') unhelpfulCount++;
                else if (doc.humanMark === 'flagged') flaggedCount++;
            }

            if (result.documents.length < pageSize) hasMore = false;
            else offset += pageSize;
        }

        // Calculate averages
        const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
        const avgLatencyMs = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

        // Calculate rates (0-100)
        const helpfulRate = totalResponses > 0 ? (helpfulCount / totalResponses) * 100 : 0;
        const unhelpfulRate = totalResponses > 0 ? (unhelpfulCount / totalResponses) * 100 : 0;

        // Flattened structure to match AccuracyStats.tsx interface
        const stats = {
            totalResponses,
            avgConfidence,
            avgLatencyMs,
            helpfulRate,
            unhelpfulRate,
            flaggedCount,
            startDate: fromDate.toISOString(),
            endDate: toDate.toISOString()
        };

        accuracyStatsCache.set(cacheKey, stats);
        res.json(stats);
    } catch (err) {
        console.error('Error calculating accuracy stats:', err);
        res.status(500).json({ error: 'Failed to calculate stats' });
    }
};

// Encryption Endpoints

const getEncryptionStatus = async (req, res) => {
    try {
        const status = {
            encryptionEnabled: ENCRYPTION_ENABLED,
            masterKeyPresent: !!MASTER_KEY_BASE64,
            redactPII: REDACT_PII,
            collections: {}
        };

        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.json({ ...status, message: 'Appwrite not configured' });
        }

        // Sample scan to count encrypted vs plaintext docs
        const collections = [
            { id: APPWRITE_MESSAGES_COLLECTION_ID, name: 'messages', field: 'encrypted' },
            { id: APPWRITE_SESSIONS_COLLECTION_ID, name: 'sessions', field: 'encrypted_userMeta' },
            { id: APPWRITE_USERS_COLLECTION_ID, name: 'users', field: 'encrypted_notes' },
            { id: APPWRITE_AI_ACCURACY_COLLECTION_ID, name: 'ai_accuracy', field: 'encrypted_aiText' }
        ];

        for (const coll of collections) {
            if (!coll.id) continue;

            try {
                const sample = await awDatabases.listDocuments(
                    APPWRITE_DATABASE_ID,
                    coll.id,
                    [],
                    100
                );

                let encryptedCount = 0;
                let plaintextCount = 0;

                sample.documents.forEach(doc => {
                    if (doc[coll.field] && encryption && encryption.isEncrypted(doc[coll.field])) {
                        encryptedCount++;
                    } else if (doc[coll.field] || doc.text || doc.userMeta || doc.sensitiveNotes || doc.aiText) {
                        plaintextCount++;
                    }
                });

                status.collections[coll.name] = {
                    encrypted: encryptedCount,
                    plaintext: plaintextCount,
                    total: sample.total
                };
            } catch (err) {
                status.collections[coll.name] = { error: err.message };
            }
        }

        await logEncryptionAction('status_check', req.user?.userId || 'unknown', status);
        res.json(status);
    } catch (err) {
        console.error('Error getting encryption status:', err);
        res.status(500).json({ error: err?.message || 'Failed to get status' });
    }
};

const reencryptData = async (req, res) => {
    try {
        const { newMasterKeyBase64 } = req.body;

        if (!newMasterKeyBase64) {
            return res.status(400).json({ error: 'newMasterKeyBase64 required in request body' });
        }

        // Validate key length
        const keyBuffer = Buffer.from(newMasterKeyBase64, 'base64');
        if (keyBuffer.length !== 32) {
            return res.status(400).json({ error: 'newMasterKeyBase64 must decode to 32 bytes' });
        }

        // For large datasets, return 202 and suggest using migration script
        res.status(202).json({
            message: 'Key rotation should be performed using migration script: node migrations/rotate_master_key.js',
            jobId: `rotation_${Date.now()}`,
            instructions: [
                '1. Set NEW_MASTER_KEY_BASE64 environment variable',
                '2. Run: node migrations/rotate_master_key.js --preview (to preview)',
                '3. Run: node migrations/rotate_master_key.js (to execute)',
                '4. Update MASTER_KEY_BASE64 in environment after rotation'
            ]
        });

        await logEncryptionAction('reencrypt_requested', req.user?.userId || 'unknown', { newKeySet: true });
    } catch (err) {
        console.error('Error requesting reencrypt:', err);
        res.status(500).json({ error: err?.message || 'Failed to request reencrypt' });
    }
};

const cleanupPlaintext = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        const { collection, confirm } = req.body;

        if (confirm !== 'yes') {
            return res.status(400).json({
                error: 'Must confirm with { "confirm": "yes" } to remove plaintext backups'
            });
        }

        // This is a dangerous operation - recommend using migration script
        res.status(400).json({
            error: 'Use migration script for cleanup',
            instructions: [
                'Run migration script to encrypt existing data first',
                'Then manually remove text_plain_removed_at fields via Appwrite Console',
                'Or create a custom cleanup script'
            ]
        });

        await logEncryptionAction('cleanup_requested', req.user?.userId || 'unknown', { collection });
    } catch (err) {
        console.error('Error requesting cleanup:', err);
        res.status(500).json({ error: err?.message || 'Failed to request cleanup' });
    }
};

const getEncryptionAudit = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.json({ logs: [], message: 'Appwrite not configured' });
        }

        const limit = parseInt(req.query.limit) || 50;

        try {
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_ENCRYPTION_AUDIT_COLLECTION_ID || 'encryption_audit',
                [],
                limit
            );

            res.json({ logs: result.documents });
        } catch (err) {
            // Collection might not exist
            res.json({ logs: [], message: 'Audit collection not found' });
        }
    } catch (err) {
        console.error('Error getting encryption audit:', err);
        res.status(500).json({ error: err?.message || 'Failed to get audit log' });
    }
};

// ============================================================================
// HEALTH CHECKS
// ============================================================================

// GET / - Live check
const healthCheck = (req, res) => {
    res.send('API is running live!');
};

// GET /health/db - Database health check
const dbHealthCheck = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({
                status: 'unavailable',
                message: 'Appwrite not configured',
                details: {
                    endpoint: APPWRITE_ENDPOINT || 'Not set',
                    projectId: APPWRITE_PROJECT_ID ? 'Set' : 'Not set',
                    apiKey: APPWRITE_API_KEY ? 'Set' : 'Not set',
                    databaseId: APPWRITE_DATABASE_ID || 'Not set'
                }
            });
        }

        // Try to connect to Appwrite by listing a collection
        try {
            await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_USERS_COLLECTION_ID,
                [],
                1
            );
            return res.json({
                status: 'healthy',
                message: 'Database connection successful',
                endpoint: APPWRITE_ENDPOINT
            });
        } catch (dbError) {
            return res.status(503).json({
                status: 'unavailable',
                message: 'Database connection failed',
                error: dbError.message,
                endpoint: APPWRITE_ENDPOINT,
                troubleshooting: [
                    'Check if APPWRITE_ENDPOINT is correct and reachable',
                    'Verify APPWRITE_PROJECT_ID and APPWRITE_API_KEY are correct',
                    'Ensure your network can reach the Appwrite endpoint',
                    'Check if Appwrite service is running and accessible'
                ]
            });
        }
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: err.message
        });
    }
};

module.exports = {
    proxyImage,
    getAccuracyRecords,
    getAccuracyStats,
    getEncryptionStatus,
    reencryptData,
    cleanupPlaintext,
    getEncryptionAudit,
    healthCheck,
    dbHealthCheck
};
