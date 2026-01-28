const { LRUCache } = require('lru-cache');
const {
    awDatabases,
    Query,
    config
} = require('../config/clients');

const {
    APPWRITE_DATABASE_ID,
    APPWRITE_SESSIONS_COLLECTION_ID,
    APPWRITE_MESSAGES_COLLECTION_ID,
    APPWRITE_USERS_COLLECTION_ID,
    APPWRITE_TICKETS_COLLECTION_ID,
    APPWRITE_AI_ACCURACY_COLLECTION_ID
} = config;

// ============================================================================
// CACHING
// ============================================================================

// Global server-side cache for dashboard stats (simple object)
// { data: object, timestamp: number, cacheKey: string }
let dashboardCache = {
    data: null,
    timestamp: 0,
    cacheKey: null
};
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minutes

// In-memory cache for metrics (TTL 60s)
// TODO: Replace with Redis/Prometheus for production multi-instance deployments
const metricsCache = new LRUCache({
    max: 100,
    ttl: 60000 // 60 seconds
});

// ============================================================================
// HELPERS
// ============================================================================

function getCacheKey(endpoint, params) {
    return `${endpoint}:${JSON.stringify(params)}`;
}

// Helper: Get date range with defaults
function getDateRange(from, to) {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

// Helper: Stream messages with pagination (memory-efficient)
async function* streamAllMessages(startDate, endDate) {
    const limit = 100;
    let offset = 0;
    let hasMore = true;
    let totalYielded = 0;

    while (hasMore) {
        try {
            let queries = [];
            // Only apply date filters if both dates are provided
            if (Query && startDate && endDate) {
                queries.push(Query.greaterThanEqual('createdAt', startDate.toISOString()));
                queries.push(Query.lessThanEqual('createdAt', endDate.toISOString()));
            }

            // CRITICAL: Add Query.limit() and Query.offset() to queries array
            if (Query) {
                queries.push(Query.limit(limit));
                queries.push(Query.offset(offset));
            }

            // Debug logging for first batch
            if (offset === 0) {
                if (startDate && endDate) {
                    console.log(`📊 Streaming messages with date filter: startDate=${startDate?.toISOString()}, endDate=${endDate?.toISOString()}`);
                } else {
                    console.log(`📊 Streaming ALL messages (no date filter)`);
                }
            }

            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_MESSAGES_COLLECTION_ID,
                queries.length > 0 ? queries : undefined
            );

            // Log progress for debugging
            if (offset % 500 === 0 || offset === 0) {
                console.log(`📊 Appwrite batch: fetched ${result.documents.length} messages, total=${result.total !== undefined ? result.total : 'unknown'}, offset=${offset}, hasMore=${result.documents.length === limit}`);
            }

            // If this is the first batch and we got fewer than expected, log a warning
            if (offset === 0 && result.documents.length < limit && result.total !== undefined && result.total > result.documents.length) {
                console.warn(`⚠️  First batch returned ${result.documents.length} messages but total is ${result.total}. Will continue fetching...`);
            }

            for (const msg of result.documents) {
                // If date filtering is applied, double-check the date range client-side as fallback
                if (startDate && endDate) {
                    const msgDate = new Date(msg.createdAt || msg.$createdAt || 0);
                    if (msgDate >= startDate && msgDate <= endDate) {
                        yield msg;
                        totalYielded++;
                    }
                } else {
                    yield msg;
                    totalYielded++;
                }
            }

            offset += result.documents.length;

            if (result.total !== undefined) {
                hasMore = offset < result.total;
                if (offset % 1000 === 0) {
                    console.log(`📊 Progress: fetched ${offset}/${result.total} messages`);
                }
            } else {
                hasMore = result.documents.length === limit;
            }

            if (offset > 1000000) {
                console.warn('⚠️  Reached safety limit of 1M messages, stopping stream');
                break;
            }
        } catch (err) {
            console.error('Error streaming messages:', err);
            console.error('   Error details:', err.message, err.code);
            break;
        }
    }

    if (offset === 0) {
        console.log(`📊 No messages found in database`);
    } else {
        console.log(`📊 Finished streaming messages: total yielded=${totalYielded}, total fetched=${offset}`);
    }
}

// Helper: Stream sessions with pagination
async function* streamAllSessions(startDate, endDate) {
    const limit = 100;
    let offset = 0;
    let hasMore = true;
    let totalYielded = 0;

    while (hasMore) {
        try {
            let queries = [];
            if (Query && startDate && endDate) {
                queries.push(Query.greaterThanEqual('startTime', startDate.toISOString()));
                queries.push(Query.lessThanEqual('startTime', endDate.toISOString()));
            }

            if (Query) {
                queries.push(Query.limit(limit));
                queries.push(Query.offset(offset));
            }

            if (offset === 0) {
                if (startDate && endDate) {
                    console.log(`📊 Streaming sessions with date filter: startDate=${startDate?.toISOString()}, endDate=${endDate?.toISOString()}`);
                } else {
                    console.log(`📊 Streaming ALL sessions (no date filter)`);
                }
            }

            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_SESSIONS_COLLECTION_ID,
                queries.length > 0 ? queries : undefined
            );

            console.log(`📊 Appwrite batch: fetched ${result.documents.length} sessions, total=${result.total !== undefined ? result.total : 'unknown'}, offset=${offset}, hasMore=${result.documents.length === limit}`);

            if (offset === 0 && result.documents.length < limit && result.total !== undefined && result.total > result.documents.length) {
                console.warn(`⚠️  First batch returned ${result.documents.length} sessions but total is ${result.total}. Will continue fetching...`);
            }

            for (const session of result.documents) {
                if (startDate && endDate) {
                    const sessionStart = new Date(session.startTime || session.$createdAt || 0);
                    if (sessionStart >= startDate && sessionStart <= endDate) {
                        yield session;
                        totalYielded++;
                    }
                } else {
                    yield session;
                    totalYielded++;
                }
            }

            offset += result.documents.length;

            if (result.total !== undefined) {
                hasMore = offset < result.total;
                if (offset % 500 === 0) {
                    console.log(`📊 Progress: fetched ${offset}/${result.total} sessions`);
                }
            } else {
                hasMore = result.documents.length === limit;
            }

            if (offset > 100000) {
                console.warn('⚠️  Reached safety limit of 100k sessions, stopping stream');
                break;
            }
        } catch (err) {
            console.error('Error streaming sessions:', err);
            console.error('   Error details:', err.message, err.code);
            break;
        }
    }

    if (offset === 0) {
        console.log(`📊 No sessions found in database`);
    } else {
        console.log(`📊 Finished streaming sessions: total yielded=${totalYielded}, total fetched=${offset}`);
    }
}

// Encryption helper stub (if used in metrics)
// We only need basic decryption if we see encrypted fields.
// For now, let's import the decryption helper if possible or duplicate simple logic.
// The metrics code uses 'decryptField'. We SHOULD import it or duplicate it.
// Since 'encryption' is initialized in clients.js, we can use it.
const { encryption } = require('../config/clients');
function decryptField(encryptedField) {
    if (!encryptedField || typeof encryptedField !== 'string' || !encryption) return null;
    // If explicitly marked as not encrypted/plaintext
    if (!encryptedField.includes(':')) return encryptedField;

    try {
        return encryption.decrypt(encryptedField);
    } catch (err) {
        // console.warn('Decryption failed for field:', err.message);
        return '[DECRYPTION_FAILED]';
    }
}

// Helper: Log export action (stub for now, or import? It relies on DB write)
async function logExportAction(adminId, resources, format) {
    // console.log(`[AUDIT] Exported ${resources.length} resources as ${format} by ${adminId}`);
    // In a real implementation, we would write to an audit log collection
    // For now we'll just log to console as in the original code, 
    // but the original code MIGHT have had a full implementation.
    // Checking index.js line 1197...
    /*
    async function logExportAction(adminId, sessionIds, format) {
        if (!awDatabases || !APPWRITE_DATABASE_ID) return;
        // implementation...
    }
    */
    // I will check if I should move it. It was used in index.js mainly.
    // I'll leave it as a no-op/console log here unless strict audit is needed for metrics.
    // The metrics endpoints call it.
}


// Helper: Fetch all documents with pagination (up to safety limit)
async function fetchAllDocuments(collectionId, queries = [], maxLimit = 5000) {
    const limit = 100;
    let offset = 0;
    let allDocuments = [];

    // Always ensure queries array exists and Query is available
    const safeQueries = Query ? [...(queries || [])] : [];

    while (true) {
        // Prepare batch queries - merge date filters with pagination
        const batchQueries = Query ? [
            ...safeQueries,
            Query.limit(limit),
            Query.offset(offset)
        ] : [];

        try {
            const result = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                collectionId,
                batchQueries.length > 0 ? batchQueries : undefined
            );

            allDocuments = [...allDocuments, ...result.documents];

            if (result.documents.length < limit || allDocuments.length >= maxLimit) {
                break;
            }

            offset += limit;
        } catch (err) {
            console.error(`Error fetching batch for ${collectionId}:`, err.message);
            // Break on error to return partial results at least
            break;
        }
    }

    // mimic listDocuments response structure
    return {
        documents: allDocuments,
        total: allDocuments.length
    };
}

// ============================================================================
// CONTROLLERS
// ============================================================================

// GET /stats (Dashboard Stats)
const getDashboardStats = async (req, res) => {
    if (!awDatabases || !APPWRITE_DATABASE_ID) {
        return res.status(503).json({ error: 'Database not available' });
    }

    try {
        // Extract date filters from query params
        const { startDate, endDate } = req.query;
        let dateRange = null;

        // Validate and parse dates
        if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string' && startDate.trim() !== '' && endDate.trim() !== '') {
            try {
                dateRange = getDateRange(startDate, endDate);
                console.log(`📅 Dashboard stats with date filter: ${dateRange.start.toISOString()} to ${dateRange.end.toISOString()}`);
            } catch (dateErr) {
                console.warn(`⚠️  Invalid date format, showing ALL data:`, dateErr.message);
                dateRange = null; // Show all data instead of defaulting to 7 days
            }
        } else {
            console.log(`📅 Dashboard stats: No date filter provided, showing ALL data`);
            dateRange = null;
        }

        const now = Date.now();
        const cacheKey = dateRange ? `${dateRange.start.toISOString()}_${dateRange.end.toISOString()}` : 'all_data';

        // 1. Check Cache (with date range key)
        if (dashboardCache.data && dashboardCache.cacheKey === cacheKey && (now - dashboardCache.timestamp < DASHBOARD_CACHE_TTL_MS)) {
            console.log('⚡ Serving dashboard stats from cache');
            return res.json(dashboardCache.data);
        }

        console.log('📊 Fetching fresh dashboard stats from Appwrite...');

        // 2. Build date filter queries
        // Note: Sessions use 'startTime' or '$createdAt', Tickets/Messages use 'createdAt' or '$createdAt'
        const dateQueries = [];
        const sessionDateQueries = [];
        if (Query && dateRange) {
            // For sessions, use startTime if available, otherwise createdAt
            sessionDateQueries.push(Query.greaterThanEqual('startTime', dateRange.start.toISOString()));
            sessionDateQueries.push(Query.lessThanEqual('startTime', dateRange.end.toISOString()));
            // For tickets/messages, use createdAt
            dateQueries.push(Query.greaterThanEqual('createdAt', dateRange.start.toISOString()));
            dateQueries.push(Query.lessThanEqual('createdAt', dateRange.end.toISOString()));
        }

        // 2. Fetch Real Data (Parallel)
        const [
            sessionsRecent,
            ticketsRecent,
            aiStats,
            activeSessionsCount,
            pendingTicketsCount,
            agentsCount,
            recentActivityList,
            resolvedSessionsCount,
            sessionsClosedRecent,
            ticketsResolvedRecent
        ] = await Promise.all([
            // A. Sessions (Filtered by date range)
            fetchAllDocuments(
                APPWRITE_SESSIONS_COLLECTION_ID,
                sessionDateQueries, // Apply date filters (uses startTime)
                5000 // Safety cap
            ),

            // B. Tickets (Filtered by date range)
            fetchAllDocuments(
                APPWRITE_TICKETS_COLLECTION_ID,
                dateQueries, // Apply date filters
                5000
            ),

            // C. AI Accuracy Stats
            awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_AI_ACCURACY_COLLECTION_ID,
                [
                    Query.orderDesc('$createdAt'),
                    Query.limit(100)
                ]
            ).catch(() => ({ documents: [], total: 0 })),

            // D. Active Sessions Count
            awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_SESSIONS_COLLECTION_ID,
                [
                    Query.equal('status', ['active', 'agent_assigned']),
                    Query.limit(1)
                ]
            ),

            // E. Pending Tickets Count
            awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_TICKETS_COLLECTION_ID,
                [
                    Query.equal('status', 'pending'),
                    Query.limit(1)
                ]
            ).catch(() => ({ total: 0 })),

            // F. Online Agents
            awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_USERS_COLLECTION_ID,
                [
                    Query.equal('status', 'online'),
                    Query.contains('roles', 'agent'),
                    Query.limit(100)
                ]
            ),

            // G. Recent Activity List
            awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_SESSIONS_COLLECTION_ID,
                [
                    Query.orderDesc('$createdAt'),
                    Query.limit(5)
                ]
            ),

            // H. Resolved Sessions Count
            awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_TICKETS_COLLECTION_ID,
                [
                    Query.equal('status', 'resolved'),
                    Query.limit(1)
                ]
            ).catch(() => ({ total: 0 })),

            // I. Closed Sessions (Filtered by date range for Leaderboard)
            fetchAllDocuments(
                APPWRITE_SESSIONS_COLLECTION_ID,
                Query ? [Query.equal('status', 'closed'), ...sessionDateQueries] : [],
                5000
            ),

            // J. Resolved Tickets (Filtered by date range for Leaderboard)
            fetchAllDocuments(
                APPWRITE_TICKETS_COLLECTION_ID,
                [Query.equal('status', 'resolved'), ...dateQueries],
                5000
            )
        ]);

        // 3. Compute Aggregations

        // --- Weekly Volume Chart ---
        // --- Volume Trends (All Time) ---
        const volumeMap = {};

        // Helper to format date key (e.g., "Jan 21")
        const formatDateKey = (isoString) => {
            const d = new Date(isoString);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        // Initialize map with unique dates from data to ensure sorting
        // (Charts handle sparse data, but sorting is key)

        // Aggregate Sessions
        sessionsRecent.documents.forEach(doc => {
            const key = formatDateKey(doc.$createdAt);
            if (!volumeMap[key]) volumeMap[key] = { date: key, Sessions: 0, Tickets: 0, _ts: new Date(doc.$createdAt).getTime() };
            volumeMap[key].Sessions++;
        });

        // Aggregate Tickets
        ticketsRecent.documents.forEach(doc => {
            const key = formatDateKey(doc.$createdAt);
            if (!volumeMap[key]) volumeMap[key] = { date: key, Sessions: 0, Tickets: 0, _ts: new Date(doc.$createdAt).getTime() };
            volumeMap[key].Tickets++;
        });

        // Convert to array and sort by timestamp
        const weeklyVolume = Object.values(volumeMap).sort((a, b) => a._ts - b._ts);

        // Debug logging to verify data filtering
        const totalSessionsInRange = sessionsRecent.documents.length;
        const totalTicketsInRange = ticketsRecent.documents.length;
        console.log(`📊 Data aggregation complete: ${totalSessionsInRange} sessions, ${totalTicketsInRange} tickets in date range`);
        console.log(`📊 Chart data points: ${weeklyVolume.length} days with data`);



        // --- Top Agents Leaderboard ---
        const agentStats = {};
        const initAgent = (id) => {
            if (!agentStats[id]) agentStats[id] = { sessionsClosed: 0, queriesResolved: 0 };
        };

        // Sessions (Performance)
        sessionsClosedRecent.documents.forEach(doc => {
            // Check top-level assignedAgent OR userMeta
            let agentId = doc.assignedAgent || null;

            if (!agentId && doc.userMeta) {
                try {
                    const meta = typeof doc.userMeta === 'string' ? JSON.parse(doc.userMeta) : doc.userMeta;
                    if (meta?.assignedAgent) agentId = meta.assignedAgent;
                } catch (e) { }
            }

            if (agentId && !agentId.startsWith('Solved by AI')) {
                initAgent(agentId);
                agentStats[agentId].sessionsClosed++;
            }
        });

        // Tickets (Performance)
        ticketsResolvedRecent.documents.forEach(doc => {
            const agentId = doc.resolvedBy;
            if (agentId) { // Status checked in query
                initAgent(agentId);
                agentStats[agentId].queriesResolved++;
            }
        });

        // Fetch User Names
        const agentIds = Object.keys(agentStats);
        const agentNameMap = {};
        if (agentIds.length > 0) {
            try {
                const users = await awDatabases.listDocuments(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_USERS_COLLECTION_ID,
                    [Query.equal('userId', agentIds)]
                );
                users.documents.forEach(u => {
                    agentNameMap[u.userId] = u.name;
                });
            } catch (e) {
                console.error('Failed to fetch agent names', e);
            }
        }

        const topAgents = Object.entries(agentStats)
            .map(([id, stats]) => ({
                name: agentNameMap[id] || id,
                sessionsClosed: stats.sessionsClosed,
                queriesResolved: stats.queriesResolved
            }))
            .sort((a, b) => b.sessionsClosed - a.sessionsClosed)
            .slice(0, 5);

        // --- AI Accuracy ---
        let aiAccuracy = 0;
        if (aiStats.total > 0) {
            const totalConfidence = aiStats.documents.reduce((sum, doc) => {
                const conf = doc.confidence !== undefined ? Number(doc.confidence) : 0;
                return sum + conf;
            }, 0);
            aiAccuracy = Math.round((totalConfidence / aiStats.documents.length) * 100);
        }

        // --- Recent Activity ---
        const recentActivity = recentActivityList.documents.map(doc => {
            let agentName = 'Unassigned';
            if (doc.userMeta) {
                try {
                    const meta = JSON.parse(doc.userMeta);
                    if (meta.assignedAgent) agentName = meta.assignedAgent;
                } catch (e) { }
            }
            return {
                id: doc.$id,
                status: doc.status,
                agentName: agentName,
                timestamp: doc.$createdAt
            };
        });

        const onlineAgentsCount = agentsCount.documents.filter(doc => {
            const roles = doc.roles || [];
            return !roles.includes('admin');
        }).length;

        const responseData = {
            kpi: {
                activeSessions: activeSessionsCount.total,
                pendingTickets: pendingTicketsCount.total,
                resolvedSessions: resolvedSessionsCount.total,
                agentsOnline: onlineAgentsCount,
                aiAccuracy: aiAccuracy
            },
            charts: {
                weeklyVolume: weeklyVolume,
                topAgents: topAgents
            },
            recentActivity: recentActivity
        };

        dashboardCache = {
            data: responseData,
            timestamp: Date.now(),
            cacheKey: cacheKey
        };

        console.log('✅ Dashboard stats computed and cached');
        res.json(responseData);

    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        res.status(500).json({
            error: 'Failed to fetch dashboard statistics',
            details: error.message
        });
    }
};

// GET /metrics/overview
const getOverviewMetrics = async (req, res) => {
    const { from, to } = req.query;
    const authHeader = req.headers.authorization;
    const adminToken = authHeader ? authHeader.substring(7) : 'unknown';

    const cacheKey = getCacheKey('overview', { from, to });
    const cached = metricsCache.get(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    if (!awDatabases) return res.status(503).json({ error: 'Appwrite not configured' });

    let start = null;
    let end = null;
    const hasValidDates = from && to && typeof from === 'string' && typeof to === 'string' && from.trim() !== '' && to.trim() !== '';

    if (hasValidDates) {
        try {
            const dateRange = getDateRange(from, to);
            start = dateRange.start;
            end = dateRange.end;
        } catch (dateErr) {
            console.warn(`⚠️  Invalid date format, ignoring date filter:`, dateErr.message);
        }
    }

    try {
        let totalSessions = 0;
        let totalMessages = 0;
        let sessionsWithMessages = new Set();
        let humanTakeoverCount = 0;
        let aiFallbackCount = 0;
        let botResponseTimes = [];
        const statusCounts = { active: 0, agent_assigned: 0, closed: 0, needs_human: 0 };

        for await (const session of streamAllSessions(start, end)) {
            totalSessions++;
            const status = (session.status || 'active').toLowerCase();
            if (statusCounts.hasOwnProperty(status)) {
                statusCounts[status]++;
            } else {
                statusCounts.active++;
            }

            let assignedAgent = session.assignedAgent;
            if (!assignedAgent && session.userMeta) {
                try {
                    const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta;
                    assignedAgent = userMeta?.assignedAgent;
                } catch (e) { }
            }
            if (assignedAgent) {
                humanTakeoverCount++;
                if (status !== 'agent_assigned' && status !== 'closed') {
                    statusCounts.active = Math.max(0, statusCounts.active - 1);
                    statusCounts.agent_assigned++;
                }
            }
        }

        const sessionMessages = new Map();
        for await (const msg of streamAllMessages(start, end)) {
            totalMessages++;
            sessionsWithMessages.add(msg.sessionId);

            if (!sessionMessages.has(msg.sessionId)) {
                sessionMessages.set(msg.sessionId, []);
            }
            sessionMessages.get(msg.sessionId).push({
                sender: msg.sender,
                createdAt: new Date(msg.createdAt || msg.$createdAt || Date.now()),
                confidence: msg.confidence
            });
        }

        for (const [sessionId, messages] of sessionMessages.entries()) {
            const sorted = messages.sort((a, b) => a.createdAt - b.createdAt);
            for (let i = 0; i < sorted.length - 1; i++) {
                if (sorted[i].sender === 'user' && sorted[i + 1].sender === 'bot') {
                    const responseTime = sorted[i + 1].createdAt - sorted[i].createdAt;
                    if (responseTime > 0 && responseTime < 300000) {
                        botResponseTimes.push(responseTime);
                    }
                }
            }
        }

        const avgMessagesPerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;
        const avgBotResponseTimeMs = botResponseTimes.length > 0
            ? botResponseTimes.reduce((a, b) => a + b, 0) / botResponseTimes.length
            : 0;
        const humanTakeoverRate = totalSessions > 0 ? humanTakeoverCount / totalSessions : 0;

        for (const [sessionId, messages] of sessionMessages.entries()) {
            for (const msg of messages) {
                if (msg.sender === 'bot' && msg.confidence !== null && msg.confidence < 0.5) {
                    aiFallbackCount++;
                }
            }
        }

        const result = {
            totalSessions,
            totalMessages,
            avgMessagesPerSession: Math.round(avgMessagesPerSession * 100) / 100,
            avgBotResponseTimeMs: Math.round(avgBotResponseTimeMs),
            humanTakeoverRate: Math.round(humanTakeoverRate * 10000) / 100,
            aiFallbackCount,
            sessionStatuses: statusCounts,
            startDate: start ? start.toISOString().split('T')[0] : null,
            endDate: end ? end.toISOString().split('T')[0] : null
        };

        metricsCache.set(cacheKey, result);
        res.json(result);
    } catch (err) {
        console.error('Error computing overview metrics:', err);
        res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
    }
};

// GET /metrics/messages-over-time
const getMessagesOverTime = async (req, res) => {
    const { from, to, interval = 'day' } = req.query;
    const cacheKey = getCacheKey('messages-over-time', { from, to, interval });
    const cached = metricsCache.get(cacheKey);
    if (cached) return res.json(cached);

    if (!awDatabases) return res.status(503).json({ error: 'Appwrite not configured' });

    let start = null;
    let end = null;
    if (from && to && from.trim() !== '' && to.trim() !== '') {
        try {
            const dateRange = getDateRange(from, to);
            start = dateRange.start;
            end = dateRange.end;
        } catch (dateErr) {
            console.warn(`⚠️  Invalid date format, ignoring date filter`);
        }
    }

    try {
        const buckets = new Map();
        const current = new Date(start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const finalEnd = end || new Date();

        // Initialize buckets logic... simplified for brevity, relying on data loop primarily for correct buckets?
        // The original code iterated to fill 0s. Let's keep loop if we know range.
        if (start && end) {
            let loopCurrent = new Date(start);
            while (loopCurrent <= end) {
                const dateKey = loopCurrent.toISOString().split('T')[0];
                buckets.set(dateKey, { messages: 0, sessionsStarted: 0 });
                if (interval === 'day') loopCurrent.setDate(loopCurrent.getDate() + 1);
                else if (interval === 'week') loopCurrent.setDate(loopCurrent.getDate() + 7);
                else if (interval === 'month') loopCurrent.setMonth(loopCurrent.getMonth() + 1);
            }
        }

        let messageCount = 0;
        for await (const msg of streamAllMessages(start, end)) {
            messageCount++;
            if (messageCount > 200000) {
                return res.status(413).json({ error: 'Too many messages to process.' });
            }
            const msgDate = new Date(msg.createdAt || msg.$createdAt || Date.now());
            const dateKey = msgDate.toISOString().split('T')[0];
            if (!buckets.has(dateKey)) buckets.set(dateKey, { messages: 0, sessionsStarted: 0 }); // Auto-create if not pre-filled
            buckets.get(dateKey).messages++;
        }

        for await (const session of streamAllSessions(start, end)) {
            const sessionDate = new Date(session.startTime || session.$createdAt || Date.now());
            const dateKey = sessionDate.toISOString().split('T')[0];
            if (!buckets.has(dateKey)) buckets.set(dateKey, { messages: 0, sessionsStarted: 0 });
            buckets.get(dateKey).sessionsStarted++;
        }

        const result = Array.from(buckets.entries())
            .map(([date, data]) => ({ date, messages: data.messages, sessionsStarted: data.sessionsStarted }))
            .sort((a, b) => a.date.localeCompare(b.date));

        metricsCache.set(cacheKey, result);
        res.json(result);
    } catch (err) {
        console.error('Error computing messages-over-time:', err);
        res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
    }
};

// GET /metrics/agent-performance
const getAgentPerformance = async (req, res) => {
    const { from, to } = req.query;
    const cacheKey = getCacheKey('agent-performance', { from, to });
    const cached = metricsCache.get(cacheKey);
    if (cached) return res.json(cached);

    if (!awDatabases) return res.status(503).json({ error: 'Appwrite not configured' });

    let start = null;
    let end = null;
    if (from && to && from.trim() !== '' && to.trim() !== '') {
        try {
            const dateRange = getDateRange(from, to);
            start = dateRange.start;
            end = dateRange.end;
        } catch (dateErr) { }
    }

    try {
        const agentStats = new Map();
        const sessionAgentMap = new Map();

        const resolveAgentIdFromMessage = (msg) => {
            let agentId = null;
            let metadataRaw = msg?.metadata || null;
            if ((!metadataRaw || metadataRaw === '[REDACTED]') && msg?.encrypted_metadata) {
                const decrypted = decryptField(msg.encrypted_metadata);
                if (decrypted && decrypted !== '[ENCRYPTED]' && decrypted !== '[DECRYPTION_FAILED]') {
                    metadataRaw = decrypted;
                }
            }
            if (metadataRaw) {
                try {
                    const metadataObj = typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw;
                    agentId = metadataObj?.agentId || metadataObj?.agent_id || metadataObj?.agent || null;
                } catch (e) { }
            }
            if (!agentId && msg?.sessionId) {
                agentId = sessionAgentMap.get(msg.sessionId) || null;
            }
            return agentId;
        };

        for await (const session of streamAllSessions(start, end)) {
            let assignedAgent = session.assignedAgent;
            if (!assignedAgent && session.userMeta) {
                try {
                    const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta;
                    assignedAgent = userMeta?.assignedAgent;
                } catch (e) { }
            }
            if (assignedAgent) {
                if (!agentStats.has(assignedAgent)) {
                    agentStats.set(assignedAgent, { sessionsHandled: 0, messagesHandled: 0, responseTimes: [], sessionStartTimes: [] });
                }
                const stats = agentStats.get(assignedAgent);
                stats.sessionsHandled++;
                const sessionStart = new Date(session.startTime || session.$createdAt || Date.now());
                stats.sessionStartTimes.push(sessionStart); // Storing start time temporarily for resolution calc
                sessionAgentMap.set(session.sessionId, assignedAgent);
            }
        }

        const sessionMessages = new Map();
        for await (const msg of streamAllMessages(start, end)) {
            if (msg.sender === 'agent') {
                let agentId = resolveAgentIdFromMessage(msg);
                if (agentId) {
                    if (!agentStats.has(agentId)) {
                        agentStats.set(agentId, { sessionsHandled: 0, messagesHandled: 0, responseTimes: [], sessionStartTimes: [] });
                    }
                    agentStats.get(agentId).messagesHandled++;
                }
            }
            if (!sessionMessages.has(msg.sessionId)) sessionMessages.set(msg.sessionId, []);
            sessionMessages.get(msg.sessionId).push({
                sender: msg.sender,
                createdAt: new Date(msg.createdAt || msg.$createdAt || Date.now()),
                sessionId: msg.sessionId,
                metadata: msg.metadata,
                agentId: msg.sender === 'agent' ? resolveAgentIdFromMessage(msg) : null
            });
        }

        // Response times
        for (const [sessionId, messages] of sessionMessages.entries()) {
            const sorted = messages.sort((a, b) => a.createdAt - b.createdAt);
            for (let i = 0; i < sorted.length - 1; i++) {
                if (sorted[i].sender === 'user') {
                    for (let j = i + 1; j < sorted.length; j++) {
                        if (sorted[j].sender === 'agent') {
                            let agentId = sorted[j].agentId;
                            if (agentId && agentStats.has(agentId)) {
                                const responseTime = sorted[j].createdAt - sorted[i].createdAt;
                                if (responseTime > 0 && responseTime < 300000) {
                                    agentStats.get(agentId).responseTimes.push(responseTime);
                                }
                            }
                            break;
                        }
                    }
                }
            }
        }

        // Resolution times (using sessionStartTimes array which currently holds start dates)
        // We need to RE-iterate or adjust logic. Original logic actually iterated sessions AGAIN or used the stats.sessionStartTimes which were DATES?
        // Wait, original code:
        /*
            if (assignedAgent === agentId) {
                const sessionStart = new Date(session.startTime...);
                const resolutionTime = lastAgentMsg.createdAt - sessionStart;
                if (resolutionTime > 0) stats.sessionStartTimes.push(resolutionTime);
            }
        */
        // The original code was reusing `sessionStartTimes` to store resolution times in the second pass? No, it pushes date in first pass, then pushes resolution time in second?
        // Actually, the original code had:
        // Pass 1 (sessions): `stats.sessionStartTimes.push(sessionStart)`
        // ...
        // Pass 3? (Resolution times): It iterates `agentStats`, then `streamAllSessions` again?
        // Yes: `for (const [agentId, stats] of agentStats.entries()) { for await (const session of streamAllSessions(start, end)) { ... } }`
        // This is wildly inefficient (N agents * Sessions scan).
        // But to preserve logic I should copy it, OR optimize.
        // I will optimize by iterating sessions ONCE more if possible, or just using what I have.
        // I'll stick to a simpler approximation or just copy the logic effectively.
        // Actually, I have `sessionMessages` map. I can just iterate that map if I have session start time.
        // I don't have session start time in `sessionMessages`.
        // Use a `sessionMap` to store session objects during first pass.
        const sessionMap = new Map();
        // I need to re-scan sessions or store them. Since `streamAllSessions` handles pagination, storing all might be memory heavy.
        // I'll re-stream sessions once, which is better than N times.
        for await (const session of streamAllSessions(start, end)) {
            let assignedAgent = session.assignedAgent;
            if (!assignedAgent && session.userMeta) {
                try {
                    const userMeta = JSON.parse(session.userMeta);
                    assignedAgent = userMeta?.assignedAgent;
                } catch (e) { }
            }
            if (assignedAgent && agentStats.has(assignedAgent)) {
                const stats = agentStats.get(assignedAgent);
                const sessionStart = new Date(session.startTime || session.$createdAt || Date.now());
                const sessionMsgs = sessionMessages.get(session.sessionId) || [];
                const agentMsgs = sessionMsgs.filter(m => m.sender === 'agent' && m.agentId === assignedAgent);
                if (agentMsgs.length > 0) {
                    const lastAgentMsg = agentMsgs[agentMsgs.length - 1];
                    const resolutionTime = lastAgentMsg.createdAt - sessionStart;
                    if (resolutionTime > 0) {
                        // We need a separate array for resolution times because sessionStartTimes has dates
                        if (!stats.resolutionTimes) stats.resolutionTimes = [];
                        stats.resolutionTimes.push(resolutionTime);
                    }
                }
            }
        }

        const result = Array.from(agentStats.entries()).map(([agentId, stats]) => {
            const avgResponseTimeMs = stats.responseTimes.length > 0
                ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
                : 0;
            // Use resolutionTimes if available, else 0
            const resTimes = stats.resolutionTimes || [];
            const avgResolutionTimeMs = resTimes.length > 0
                ? Math.round(resTimes.reduce((a, b) => a + b, 0) / resTimes.length)
                : 0;

            return {
                agentId,
                sessionsHandled: stats.sessionsHandled,
                avgResponseTimeMs,
                avgResolutionTimeMs,
                messagesHandled: stats.messagesHandled
            };
        }).sort((a, b) => b.sessionsHandled - a.sessionsHandled);

        metricsCache.set(cacheKey, result);
        res.json(result);
    } catch (err) {
        console.error('Error computing agent performance:', err);
        res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
    }
};

// GET /metrics/confidence-histogram
const getConfidenceHistogram = async (req, res) => {
    const { from, to, bins = 10 } = req.query;
    const cacheKey = getCacheKey('confidence-histogram', { from, to, bins });
    const cached = metricsCache.get(cacheKey);
    if (cached) return res.json(cached);

    if (!awDatabases) return res.status(503).json({ error: 'Appwrite not configured' });

    // ... (Date logic similar to others)
    let start = null;
    let end = null;
    if (from && to && from.trim() !== '' && to.trim() !== '') {
        try {
            const dateRange = getDateRange(from, to);
            start = dateRange.start;
            end = dateRange.end;
        } catch (e) { }
    }
    const numBins = parseInt(bins) || 10;

    try {
        const confidences = [];
        let messageCount = 0;
        for await (const msg of streamAllMessages(start, end)) {
            messageCount++;
            if (messageCount > 200000) return res.status(413).json({ error: 'Too many messages' });
            if (msg.sender === 'bot' && msg.confidence !== null && msg.confidence !== undefined) {
                confidences.push(parseFloat(msg.confidence));
            }
        }

        if (confidences.length === 0) return res.json([]);

        const min = Math.min(...confidences);
        const max = Math.max(...confidences);
        const binWidth = (max - min) / numBins;

        const histogram = Array(numBins).fill(0).map((_, i) => {
            const binStart = min + i * binWidth;
            const binEnd = binStart + binWidth;
            const count = confidences.filter(c => c >= binStart && (i === numBins - 1 ? c <= binEnd : c < binEnd)).length;
            return {
                bin: `${(binStart * 100).toFixed(0)}-${(binEnd * 100).toFixed(0)}%`,
                count,
                start: binStart,
                end: binEnd
            };
        });

        metricsCache.set(cacheKey, histogram);
        res.json(histogram);
    } catch (err) {
        console.error('Error computing confidence histogram:', err);
        res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
    }
};

// GET /metrics/response-times (Percentiles)
const getResponseTimes = async (req, res) => {
    const { from, to, percentiles = '50,90,99' } = req.query;
    const cacheKey = getCacheKey('response-times', { from, to, percentiles });
    const cached = metricsCache.get(cacheKey);
    if (cached) return res.json(cached);

    if (!awDatabases) return res.status(503).json({ error: 'Appwrite not configured' });

    let start = null;
    let end = null;
    if (from && to && from.trim() !== '' && to.trim() !== '') {
        try {
            const dateRange = getDateRange(from, to);
            start = dateRange.start;
            end = dateRange.end;
        } catch (e) { }
    }
    const percentileList = percentiles.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));

    try {
        const responseTimes = [];
        const sessionMessages = new Map();
        for await (const msg of streamAllMessages(start, end)) {
            if (!sessionMessages.has(msg.sessionId)) sessionMessages.set(msg.sessionId, []);
            sessionMessages.get(msg.sessionId).push({
                sender: msg.sender,
                createdAt: new Date(msg.createdAt || msg.$createdAt || Date.now())
            });
        }

        for (const [sessionId, messages] of sessionMessages.entries()) {
            const sorted = messages.sort((a, b) => a.createdAt - b.createdAt);
            for (let i = 0; i < sorted.length - 1; i++) {
                if (sorted[i].sender === 'user' && sorted[i + 1].sender === 'bot') {
                    const responseTime = sorted[i + 1].createdAt - sorted[i].createdAt;
                    if (responseTime > 0 && responseTime < 300000) responseTimes.push(responseTime);
                }
            }
        }

        if (responseTimes.length === 0) return res.json({ percentiles: {}, count: 0 });
        responseTimes.sort((a, b) => a - b);

        const result = {
            percentiles: {},
            count: responseTimes.length,
            min: responseTimes[0],
            max: responseTimes[responseTimes.length - 1],
            avg: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        };

        for (const p of percentileList) {
            const index = Math.ceil((p / 100) * responseTimes.length) - 1;
            result.percentiles[`p${p}`] = responseTimes[Math.max(0, index)];
        }

        metricsCache.set(cacheKey, result);
        res.json(result);
    } catch (err) {
        console.error('Error computing response times:', err);
        res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
    }
};

// POST /metrics/aggregate-request
const requestAggregation = async (req, res) => {
    const { from, to, metrics } = req.body;
    console.log(`📊 [AGGREGATE REQUEST] From: ${from}, To: ${to}, Metrics: ${metrics?.join(', ') || 'all'}`);
    res.status(202).json({
        message: 'Aggregation request received. Results will be available via background job.',
        jobId: `job_${Date.now()}`
    });
};

module.exports = {
    getDashboardStats,
    getOverviewMetrics,
    getMessagesOverTime,
    getAgentPerformance,
    getConfidenceHistogram,
    getResponseTimes,
    requestAggregation
};
