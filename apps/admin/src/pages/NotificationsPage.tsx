import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

export default function NotificationsPage() {
    const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications();
    const navigate = useNavigate();

    // Filter notifications by type
    const requestNotifications = notifications.filter(n => n.type === 'request_agent');
    const assignmentNotifications = notifications.filter(n => n.type === 'assignment');

    const handleNotificationClick = async (notification: typeof notifications[0]) => {
        // Mark as read
        await markAsRead(notification.$id);

        // Only navigate if sessionId exists
        if (notification.sessionId && notification.sessionId.trim() !== '') {
            navigate(`/sessions/${notification.sessionId}`);
        }
        // If no sessionId, just mark as read (no navigation)
    };

    const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
        // Stop propagation to prevent card click
        e.stopPropagation();
        await deleteNotification(notificationId);
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    const getBadgeForNotification = (type: typeof notifications[0]['type']) => {
        if (type === 'request_agent') {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">
                    🤝 Agent Request
                </span>
            );
        } else if (type === 'assignment') {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">
                    📌 Assignment
                </span>
            );
        } else if (type === 'agent_connected' || type === 'agent_disconnected') {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                    📊 Status
                </span>
            );
        } else {
            // For other types (ticket_created, session_timeout_warning), show neutral badge
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                    ℹ️ Info
                </span>
            );
        }
    };

    const NotificationCard = ({ notification }: { notification: typeof notifications[0] }) => (
        <div
            onClick={() => handleNotificationClick(notification)}
            className="px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer flex items-start justify-between group relative"
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    {getBadgeForNotification(notification.type)}
                    <span className="text-[10px] text-gray-500">
                        {formatTime(notification.createdAt || notification.$createdAt || '')}
                    </span>
                </div>
                <p className="text-xs text-gray-900 font-medium truncate">{notification.content}</p>
                {notification.sessionId && notification.sessionId.trim() !== '' && (
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">Session: {notification.sessionId}</p>
                )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {/* Delete Button - Only visible on hover */}
                <button
                    onClick={(e) => handleDeleteNotification(e, notification.$id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                    aria-label="Delete notification"
                    title="Delete notification"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {/* Arrow icon - Only show if sessionId exists */}
                {notification.sessionId && notification.sessionId.trim() !== '' && (
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
                <p className="text-sm text-gray-600 mt-1">
                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Grid Layout: Top (All), Bottom-Left (Requests), Bottom-Right (Assignments) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* All Notifications - Full Width Card */}
                <div className="col-span-full">
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
                        {/* Card Header */}
                        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <h2 className="text-base font-semibold text-gray-800">All Notifications</h2>
                            </div>
                            <span className="bg-gray-100 text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                {notifications.length}
                            </span>
                        </div>
                        {/* Card Body */}
                        <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                    <svg className="w-16 h-16 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                    <p className="text-sm font-medium">No notifications</p>
                                    <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
                                </div>
                            ) : (
                                notifications.map(notification => (
                                    <NotificationCard key={notification.$id} notification={notification} />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Agent Requests - Bottom Left Card */}
                <div className="col-span-1">
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
                        {/* Card Header */}
                        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🤝</span>
                                <h2 className="text-base font-semibold text-gray-800">Agent Requests</h2>
                            </div>
                            <span className="bg-yellow-100 text-yellow-800 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                {requestNotifications.length}
                            </span>
                        </div>
                        {/* Card Body */}
                        <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
                            {requestNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                    <p className="text-sm font-medium">No agent requests</p>
                                    <p className="text-xs text-gray-400 mt-1">Requests will appear here</p>
                                </div>
                            ) : (
                                requestNotifications.map(notification => (
                                    <NotificationCard key={notification.$id} notification={notification} />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* My Assignments - Bottom Right Card */}
                <div className="col-span-1">
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
                        {/* Card Header */}
                        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📌</span>
                                <h2 className="text-base font-semibold text-gray-800">My Assignments</h2>
                            </div>
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                {assignmentNotifications.length}
                            </span>
                        </div>
                        {/* Card Body */}
                        <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
                            {assignmentNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                    <p className="text-sm font-medium">No assignments</p>
                                    <p className="text-xs text-gray-400 mt-1">Assignments will appear here</p>
                                </div>
                            ) : (
                                assignmentNotifications.map(notification => (
                                    <NotificationCard key={notification.$id} notification={notification} />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
