const {
    awDatabases,
    config,
    Query
} = require('../config/clients');

const {
    APPWRITE_DATABASE_ID,
    APPWRITE_USERS_COLLECTION_ID,
    APPWRITE_NOTIFICATIONS_COLLECTION_ID
} = config;

/**
 * Broadcast a system alert to all users with specific roles
 * @param {string} title - Notification title
 * @param {string} message - Notification body
 * @param {string} severity - 'info', 'warning', 'critical'
 * @param {string[]} targetRoles - Roles to target (e.g. ['admin', 'agent'])
 */
async function broadcastSystemAlert(title, message, severity = 'info', targetRoles = ['admin']) {
    if (!awDatabases || !APPWRITE_DATABASE_ID) {
        console.warn('⚠️  Cannot broadcast alert: DB not ready');
        return;
    }

    console.log(`📢 Broadcasting System Alert: "${title}" [${severity}] to roles: ${targetRoles.join(', ')}`);

    try {
        const { ID } = require('node-appwrite');

        // 1. Find target users
        // Since we can't do complex OR queries easily for array containment in some Appwrite versions for roles,
        // we might need to fetch users and filter, or do multiple queries.
        // Assuming 'roles' is a string array attribute.
        // Query.equal('roles', role) works if 'roles' is an array.

        // We'll iterate roles and fetch users (deduplicating if needed)
        // Or fetch all relevant users if the list is manageable. 
        // For efficiency, let's assume we want all admins and agents.

        let targetUserIds = new Set();

        for (const role of targetRoles) {
            // Fetch users with this role
            // Optimization: Pagination? For now, list 100 max.
            try {
                const result = await awDatabases.listDocuments(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_USERS_COLLECTION_ID,
                    [Query.equal('roles', role), Query.limit(100)]
                );

                result.documents.forEach(user => {
                    if (user.userId) targetUserIds.add(user.userId);
                });
            } catch (err) {
                console.warn(`Failed to fetch users for role ${role}:`, err.message);
            }
        }

        if (targetUserIds.size === 0) {
            console.log('ℹ️  No users found to receive alert.');
            return;
        }

        console.log(`Found ${targetUserIds.size} users to notify.`);

        // 2. Create notifications
        const promises = Array.from(targetUserIds).map(userId => {
            return awDatabases.createDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_NOTIFICATIONS_COLLECTION_ID || 'notifications',
                ID.unique(),
                {
                    targetUserId: userId, // Changed from userId to targetUserId to match schema
                    title,
                    content: message, // 'content' seems to be the field based on NotificationsPage extract
                    type: 'system',
                    isRead: false,
                    severity,
                    sessionId: 'system', // Required by schema
                    createdAt: new Date().toISOString()
                }
            ).catch(e => console.error(`Failed to notify ${userId}:`, e.message));
        });

        await Promise.all(promises);
        console.log('✅ System alert broadcast complete.');

    } catch (error) {
        console.error('❌ Error broadcasting system alert:', error);
    }
}

module.exports = {
    broadcastSystemAlert
};
