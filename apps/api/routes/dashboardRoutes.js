const express = require('express');

// Global server-side cache to protect Appwrite quota
// { data: object, timestamp: number }
let dashboardCache = {
    data: null,
    timestamp: 0
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minutes

/**
 * Dashboard Routes - Metrics and Stats for the Admin Dashboard
 */
module.exports = function (databases, config, Query) {
    const router = express.Router();
    const {
        databaseId,
        sessionsCollectionId,
        messagesCollectionId,
        usersCollectionId,
        ticketsCollectionId,
        accuracyCollectionId = 'ai_accuracy'
    } = config;

    // AI Accuracy Collection ID (fallback if not in config)
    // const accuracyCollectionId = 'ai_accuracy';

    router.get('/stats', async (req, res) => {
        if (!databases || !databaseId) {
            return res.status(503).json({ error: 'Database not available' });
        }

        try {
            const now = Date.now();

            // 1. Check Cache
            if (dashboardCache.data && (now - dashboardCache.timestamp < CACHE_TTL_MS)) {
                console.log('⚡ Serving dashboard stats from cache');
                return res.json(dashboardCache.data);
            }

            console.log('📊 Fetching fresh dashboard stats from Appwrite...');

            // Calculate 7 days ago date string
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sinceDate = sevenDaysAgo.toISOString();

            // 2. Fetch Real Data (Parallel)
            const [
                sessionsRecent,
                ticketsRecent,
                aiStats,
                activeSessionsCount,
                pendingTicketsCount,
                agentsCount,
                recentActivityList,
                resolvedSessionsCount
            ] = await Promise.all([
                // A. Sessions in last 7 days (for charts)
                databases.listDocuments(
                    databaseId,
                    sessionsCollectionId,
                    [
                        Query.greaterThanEqual('$createdAt', sinceDate),
                        Query.limit(500) // Safety limit
                    ]
                ),

                // B. Tickets in last 7 days (Fetch from Tickets Collection)
                databases.listDocuments(
                    databaseId,
                    ticketsCollectionId,
                    [
                        Query.greaterThanEqual('$createdAt', sinceDate),
                        Query.limit(500)
                    ]
                ),

                // C. AI Accuracy Stats (last 100 records)
                databases.listDocuments(
                    databaseId,
                    accuracyCollectionId,
                    [
                        Query.orderDesc('$createdAt'),
                        Query.limit(100)
                    ]
                ).catch(() => ({ documents: [], total: 0 })), // Fail gracefully if collection missing

                // D. Active Sessions Count (Total)
                databases.listDocuments(
                    databaseId,
                    sessionsCollectionId,
                    [
                        Query.equal('status', ['active', 'agent_assigned']), // Explicitly fetch active states
                        Query.limit(1)
                    ]
                ),

                // E. Pending Tickets Count (Total)
                // E. Pending Tickets Count (Total)
                databases.listDocuments(
                    databaseId,
                    ticketsCollectionId,
                    [
                        Query.equal('status', 'pending'),
                        Query.limit(1)
                    ]
                ).catch(() => ({ total: 0 })), // Fail gracefully if collection ID is wrong

                // F. Online Agents (Fetch docs to filter out admins)
                databases.listDocuments(
                    databaseId,
                    usersCollectionId,
                    [
                        Query.equal('status', 'online'),
                        Query.contains('roles', 'agent'),
                        Query.limit(100)
                    ]
                ),

                // G. Recent Activity List (Last 5)
                databases.listDocuments(
                    databaseId,
                    sessionsCollectionId,
                    [
                        Query.orderDesc('$createdAt'),
                        Query.limit(5)
                    ]
                ),

                // H. Resolved Sessions Count (Actually Resolved Tickets)
                databases.listDocuments(
                    databaseId,
                    ticketsCollectionId,
                    [
                        Query.equal('status', 'resolved'),
                        Query.limit(1)
                    ]
                ).catch(() => ({ total: 0 }))
            ]);

            // 3. Compute Aggregations

            // --- Weekly Volume Chart ---
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            // Initialize zero counts for last 7 days to ensure chart continuity
            const volumeMap = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayName = dayNames[d.getDay()];
                volumeMap[dayName] = { date: dayName, Sessions: 0, Tickets: 0 };
            }

            // Aggregate Sessions
            sessionsRecent.documents.forEach(doc => {
                const d = new Date(doc.$createdAt);
                const dayName = dayNames[d.getDay()];
                if (volumeMap[dayName]) volumeMap[dayName].Sessions++;
            });

            // Aggregate Tickets
            ticketsRecent.documents.forEach(doc => {
                const d = new Date(doc.$createdAt);
                const dayName = dayNames[d.getDay()];
                if (volumeMap[dayName]) volumeMap[dayName].Tickets++;
            });

            // Convert to Array
            // We want to sort by order of days relative to today, but for simplicity, 
            // let's just return the static list of days in order or just the values
            // A simple map of known keys is better for charts
            const weeklyVolume = Object.values(volumeMap);


            // --- Top Agents Leaderboard ---
            const agentStats = {}; // { "agentId": { sessionsClosed: 0, queriesResolved: 0 } }

            // Helper to init agent stats
            const initAgent = (id) => {
                if (!agentStats[id]) agentStats[id] = { sessionsClosed: 0, queriesResolved: 0 };
            };

            // 1. Process Sessions (Count 'closed' only)
            sessionsRecent.documents.forEach(doc => {
                if (doc.userMeta && doc.status === 'closed') {
                    try {
                        const meta = JSON.parse(doc.userMeta);
                        if (meta.assignedAgent) {
                            initAgent(meta.assignedAgent);
                            agentStats[meta.assignedAgent].sessionsClosed++;
                        }
                    } catch (e) { }
                }
            });

            // 2. Process Tickets (Count 'resolved' only)
            if (ticketsRecent.documents.length > 0) {
                console.log(`[Debug] Processing ${ticketsRecent.documents.length} recent tickets for leaderboard.`);
                const sample = ticketsRecent.documents[0];
                console.log(`[Debug] Sample Ticket ID: ${sample.$id}, Status: ${sample.status}, ResolvedBy: ${sample.resolvedBy}`);
            }

            ticketsRecent.documents.forEach(doc => {
                // FIX: Use 'resolvedBy' (Agent ID) as per DB schema
                const agentId = doc.resolvedBy;

                if (agentId && doc.status === 'resolved') {
                    initAgent(agentId);
                    agentStats[agentId].queriesResolved++;
                }
            });

            // Fetch User Names for the IDs
            const agentIds = Object.keys(agentStats);
            const agentNameMap = {};

            if (agentIds.length > 0) {
                try {
                    const users = await databases.listDocuments(
                        databaseId,
                        usersCollectionId,
                        [Query.equal('userId', agentIds)]
                    );
                    users.documents.forEach(u => {
                        agentNameMap[u.userId] = u.name;
                    });
                } catch (e) {
                    console.error('Failed to fetch agent names', e);
                }
            }

            // Convert to array and sort
            const topAgents = Object.entries(agentStats)
                .map(([id, stats]) => ({
                    name: agentNameMap[id] || id, // Show Name if found, else ID
                    sessionsClosed: stats.sessionsClosed,   // Number of sessions closed
                    queriesResolved: stats.queriesResolved // Number of queries resolved
                }))
                .sort((a, b) => b.sessionsClosed - a.sessionsClosed)
                .slice(0, 5); // Top 5


            // --- AI Accuracy ---
            let aiAccuracy = 0;
            if (aiStats.total > 0) {
                // FIX: Calculate average confidence from the DB schema
                // documents have 'confidence' (0.0 to 1.0)
                const totalConfidence = aiStats.documents.reduce((sum, doc) => {
                    // Default to 0 if confidence is missing/null
                    const conf = doc.confidence !== undefined ? Number(doc.confidence) : 0;
                    return sum + conf;
                }, 0);

                // Calculate Average %
                aiAccuracy = Math.round((totalConfidence / aiStats.documents.length) * 100);
            } else {
                aiAccuracy = 0; // Default to 0 if no data
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

            // --- Online Agents Count (Exclude Admins) ---
            // We fetched documents, so we can filter.
            const onlineAgentsCount = agentsCount.documents.filter(doc => {
                const roles = doc.roles || [];
                return !roles.includes('admin');
            }).length;

            // Debug logs removed

            // 4. Construct Final Response
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

            // 5. Update Cache
            dashboardCache = {
                data: responseData,
                timestamp: Date.now()
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
    });

    return router;
};
