const {
    awDatabases,
    Query,
    config
} = require('../config/clients');

const {
    APPWRITE_DATABASE_ID,
    APPWRITE_NOTIFICATIONS_COLLECTION_ID
} = config;

// GET /api/notifications - Fetch notifications
const getNotifications = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_NOTIFICATIONS_COLLECTION_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        const userId = req.user.userId;
        const unreadOnly = req.query.unreadOnly === 'true';

        // Build query
        const queries = [Query.orderDesc('$createdAt'), Query.limit(100)];
        if (unreadOnly) {
            queries.unshift(Query.equal('isRead', false));
        }

        const result = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_NOTIFICATIONS_COLLECTION_ID,
            queries
        );

        // Filter client-side: show broadcasts (targetUserId=null) OR user-specific notifications
        // Note: Appwrite doesn't support OR queries easily in one go for this specific filtering without permissions setup, 
        // effectively doing it client-side (app-side) here as per original code.
        const filteredNotifications = result.documents.filter(notif =>
            notif.targetUserId === null || notif.targetUserId === userId
        );

        res.json({
            notifications: filteredNotifications,
            total: filteredNotifications.length
        });

    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

// POST /api/notifications/create - Create notification
const createNotification = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_NOTIFICATIONS_COLLECTION_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        // Access 'io' from app context if needed to emit events?
        // In the original code: io.to('admin_feed').emit...
        // We can access via req.app.get('io')
        const io = req.app.get('io');
        const { type, content, sessionId, targetUserId } = req.body;

        if (!type || !content) {
            return res.status(400).json({ error: 'type and content are required' });
        }

        const { ID } = require('node-appwrite');
        const notificationData = {
            type,
            content,
            sessionId: sessionId || '',
            targetUserId: targetUserId || null,
            isRead: false
        };

        const notification = await awDatabases.createDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_NOTIFICATIONS_COLLECTION_ID,
            ID.unique(),
            notificationData
        );

        console.log(`✅ Created notification: ${notification.$id} (type: ${type})`);

        // Emit to admin feed (skip for agent_connected/agent_disconnected as these are handled via direct socket events)
        if (type !== 'agent_connected' && type !== 'agent_disconnected' && io) {
            io.to('admin_feed').emit('new_notification', notification);
        }

        res.json({
            success: true,
            notification
        });
    } catch (err) {
        console.error('Error creating notification:', err);
        res.status(500).json({ error: err?.message || 'Failed to create notification' });
    }
};

// PATCH /api/notifications/:id/read - Mark as read
const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_NOTIFICATIONS_COLLECTION_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        await awDatabases.updateDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_NOTIFICATIONS_COLLECTION_ID,
            id,
            { isRead: true }
        );

        console.log(`✅ Marked notification ${id} as read`);

        res.json({
            success: true,
            notificationId: id
        });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        if (err.code === 404) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.status(500).json({ error: err?.message || 'Failed to mark notification as read' });
    }
};

// DELETE /api/notifications/:id - Delete notification
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_NOTIFICATIONS_COLLECTION_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        try {
            const notification = await awDatabases.getDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_NOTIFICATIONS_COLLECTION_ID,
                id
            );

            // Check permission: user can delete if it's a broadcast (targetUserId=null) or their own notification
            if (notification.targetUserId !== null && notification.targetUserId !== userId) {
                return res.status(403).json({ error: 'Not authorized to delete this notification' });
            }
        } catch (getErr) {
            if (getErr.code === 404) {
                return res.status(404).json({ error: 'Notification not found' });
            }
            throw getErr;
        }

        await awDatabases.deleteDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_NOTIFICATIONS_COLLECTION_ID,
            id
        );

        console.log(`✅ Deleted notification ${id}`);

        res.json({
            success: true,
            notificationId: id
        });
    } catch (err) {
        console.error('Error deleting notification:', err);
        if (err.code === 404) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.status(500).json({ error: err?.message || 'Failed to delete notification' });
    }
};

module.exports = {
    getNotifications,
    createNotification,
    markNotificationRead,
    deleteNotification
};
