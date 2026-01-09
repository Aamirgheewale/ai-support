import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { X, ChevronRight, Inbox, FileText, Users, Edit } from 'lucide-react';
import { Card } from '../components/ui';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function NotificationsPage() {
    const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications();
    const navigate = useNavigate();
    const [resolvedTicketIds, setResolvedTicketIds] = useState<Set<string>>(new Set());

    // Fetch tickets to get resolved ticket IDs
    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                if (!token) return;

                const response = await fetch(`${API_BASE}/api/tickets`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const tickets = data.tickets || [];
                    // Create a Set of resolved ticket IDs
                    const resolvedIds = new Set<string>(
                        tickets
                            .filter((ticket: any) => ticket.status === 'resolved')
                            .map((ticket: any) => ticket.ticketId as string)
                    );
                    setResolvedTicketIds(resolvedIds);
                }
            } catch (error) {
                console.error('Failed to fetch tickets:', error);
            }
        };

        fetchTickets();
    }, []);

    // Helper function to extract ticketId from notification content
    // Format: "New ticket created: {ticketId}..." or "New ticket created: {ticketId} ({name})"
    const extractTicketId = (content: string): string | null => {
        const match = content.match(/New ticket created:\s*([^\s(]+)/);
        return match ? match[1] : null;
    };

    // Filter notifications by type
    const requestNotifications = notifications.filter(n => n.type === 'request_agent');
    const assignmentNotifications = notifications.filter(n => n.type === 'assignment');
    
    // Filter ticket notifications to exclude resolved tickets AND deduplicate by ticketId
    // Keep only the most recent notification for each ticketId
    const ticketNotifications = (() => {
        // First, filter to only ticket_created notifications and exclude resolved ones
        const ticketNotifs = notifications
            .filter(n => {
                if (n.type !== 'ticket_created') return false;
                const ticketId = extractTicketId(n.content || '');
                
                // If we can't extract ticketId, include it (better safe than sorry)
                if (!ticketId) return true;
                
                // Exclude resolved tickets
                return !resolvedTicketIds.has(ticketId);
            })
            // Sort by creation date (most recent first) to keep latest duplicates
            .sort((a, b) => {
                const dateA = new Date(a.createdAt || a.$createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || b.$createdAt || 0).getTime();
                return dateB - dateA;
            });
        
        // Deduplicate: keep only the first (most recent) occurrence of each ticketId
        const seenTicketIds = new Set<string>();
        return ticketNotifs.filter(n => {
            const ticketId = extractTicketId(n.content || '');
            
            // If we can't extract ticketId, include it
            if (!ticketId) return true;
            
            // Skip if we've already seen this ticketId
            if (seenTicketIds.has(ticketId)) return false;
            
            seenTicketIds.add(ticketId);
            return true;
        });
    })();

    const handleNotificationClick = async (notification: typeof notifications[0]) => {
        // Mark as read
        await markAsRead(notification.$id);

        // Navigate based on notification type
        if (notification.type === 'ticket_created') {
            // Navigate to pending queries page for tickets
            navigate('/pending-queries');
        } else if (notification.sessionId && notification.sessionId.trim() !== '') {
            // Navigate to session for other types
            navigate(`/sessions/${notification.sessionId}`);
        }
        // If no sessionId and not a ticket, just mark as read (no navigation)
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
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                    🤝 Agent Request
                </span>
            );
        } else if (type === 'assignment') {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    📌 Assignment
                </span>
            );
        } else if (type === 'ticket_created') {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                    🎫 New Ticket
                </span>
            );
        } else if (type === 'agent_connected' || type === 'agent_disconnected') {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    📊 Status
                </span>
            );
        } else {
            // For other types (session_timeout_warning), show neutral badge
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    ℹ️ Info
                </span>
            );
        }
    };

    const NotificationCard = ({ notification }: { notification: typeof notifications[0] }) => {
        // Determine hover colors based on notification type
        const getHoverClasses = () => {
            if (notification.type === 'ticket_created') {
                return 'hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:border-red-300 hover:border-l-red-500';
            } else if (notification.type === 'request_agent') {
                return 'hover:bg-gradient-to-r hover:from-yellow-50 hover:to-amber-50 hover:border-yellow-300 hover:border-l-yellow-500';
            } else if (notification.type === 'agent_connected') {
                return 'hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:border-green-300 hover:border-l-green-500';
            } else if (notification.type === 'agent_disconnected') {
                return 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 hover:border-gray-300 hover:border-l-gray-500';
            }
            return 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-300 hover:border-l-blue-500';
        };

        return (
        <div
            onClick={() => handleNotificationClick(notification)}
            className={`px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 ${getHoverClasses()} hover:shadow-md hover:border-l-4 transition-all duration-200 ease-in-out cursor-pointer flex items-start justify-between group relative`}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    {getBadgeForNotification(notification.type)}
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {formatTime(notification.createdAt || notification.$createdAt || '')}
                    </span>
                </div>
                <p className="text-xs text-gray-900 dark:text-gray-100 font-medium truncate">{notification.content}</p>
                {notification.sessionId && notification.sessionId.trim() !== '' && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">Session: {notification.sessionId}</p>
                )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {/* Delete Button - Only visible on hover */}
                <button
                    onClick={(e) => handleDeleteNotification(e, notification.$id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    aria-label="Delete notification"
                    title="Delete notification"
                >
                    <X className="w-4 h-4" />
                </button>
                {/* Arrow icon - Only show if sessionId exists */}
                {notification.sessionId && notification.sessionId.trim() !== '' && (
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
                )}
            </div>
        </div>
        );
    };

    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Grid Layout: Top Row (All Notifications + New Tickets), Bottom Row (Agent Requests + My Assignments) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* All Notifications - Top Left Card */}
                <div className="col-span-1">
                    <Card className="rounded-xl overflow-hidden flex flex-col h-full">
                        {/* Card Header */}
                        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Inbox className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">All Notifications</h2>
                            </div>
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                {notifications.length}
                            </span>
                        </div>
                        {/* Card Body */}
                        <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                                    <Inbox className="w-16 h-16 mb-3 text-gray-300 dark:text-gray-600" />
                                    <p className="text-sm font-medium">No notifications</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">You're all caught up!</p>
                                </div>
                            ) : (
                                notifications.map(notification => (
                                    <NotificationCard key={notification.$id} notification={notification} />
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                {/* New Tickets - Top Right Card */}
                <div className="col-span-1">
                    <Card className="rounded-xl overflow-hidden flex flex-col h-full">
                        {/* Card Header */}
                        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">New Tickets</h2>
                            </div>
                            <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                {ticketNotifications.length}
                            </span>
                        </div>
                        {/* Card Body */}
                        <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
                            {ticketNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                                    <FileText className="w-16 h-16 mb-3 text-gray-300 dark:text-gray-600" />
                                    <p className="text-sm font-medium">No new tickets</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">New tickets will appear here</p>
                                </div>
                            ) : (
                                ticketNotifications.map(notification => (
                                    <NotificationCard key={notification.$id} notification={notification} />
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                {/* Agent Requests - Bottom Left Card */}
                <div className="col-span-1">
                    <Card className="rounded-xl overflow-hidden flex flex-col h-full">
                        {/* Card Header */}
                        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Agent Requests</h2>
                            </div>
                            <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                {requestNotifications.length}
                            </span>
                        </div>
                        {/* Card Body */}
                        <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
                            {requestNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                                    <p className="text-sm font-medium">No agent requests</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Requests will appear here</p>
                                </div>
                            ) : (
                                requestNotifications.map(notification => (
                                    <NotificationCard key={notification.$id} notification={notification} />
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                {/* My Assignments - Bottom Right Card */}
                <div className="col-span-1">
                    <Card className="rounded-xl overflow-hidden flex flex-col h-full">
                        {/* Card Header */}
                        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Edit className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">My Assignments</h2>
                            </div>
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                {assignmentNotifications.length}
                            </span>
                        </div>
                        {/* Card Body */}
                        <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
                            {assignmentNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                                    <p className="text-sm font-medium">No assignments</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Assignments will appear here</p>
                                </div>
                            ) : (
                                assignmentNotifications.map(notification => (
                                    <NotificationCard key={notification.$id} notification={notification} />
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
