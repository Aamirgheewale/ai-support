const {
    awUsers,
    config
} = require('../config/clients');

const getUserSessions = async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log(`🔍 Debug - Fetching Sessions for User ID: ${userId}`);

        if (!awUsers) {
            console.warn('⚠️  Appwrite Users service not initialized');
            return res.status(503).json({ error: 'Service unavailable' });
        }

        // 1. Try to fetch sessions
        const sessionsList = await awUsers.listSessions(userId);

        // 2. Map to required fields (Preserving frontend compatibility)
        const sessions = sessionsList.sessions.map(session => ({
            id: session.$id,
            ip: session.ip,
            osName: session.osName,      // Frontend expects osName
            clientName: session.clientName, // Frontend expects clientName
            deviceBrand: session.deviceBrand,
            countryName: session.countryName, // Frontend expects countryName
            createdAt: session.$createdAt, // Frontend expects createdAt
            current: session.current
        }));

        res.json(sessions);
    } catch (err) {
        console.error(`❌ Session Fetch Error for user ${req.user?.userId}:`, err);

        // Graceful Fallback for Frontend
        if (err.code === 404 || err.type === 'user_not_found') {
            console.warn(`⚠️ User ${req.user?.userId} not found in Appwrite Auth system. Returning empty list.`);
            return res.json([]); // Return empty array so UI doesn't break
        }

        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
};

module.exports = {
    getUserSessions
};
