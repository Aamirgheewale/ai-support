import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSoundContext } from './SoundContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE;

interface Notification {
    $id: string;
    title?: string;
    type: 'request_agent' | 'assignment' | 'ticket_created' | 'session_timeout_warning';
    content: string;
    sessionId: string;
    targetUserId: string | null;
    isRead: boolean;
    createdAt?: string;
    $createdAt?: string;
}

type NotificationChannel = 'A' | 'B' | 'C';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    fetchNotifications: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const { playRing } = useSoundContext();

    // CRITICAL: Deduplication tracking - tracks all processed notification IDs
    const processedIds = useRef<Set<string>>(new Set());

    // Removed: Agent status debouncing refs (no longer needed)
    const playRingRef = useRef(playRing);

    // Keep playRing ref updated
    useEffect(() => {
        playRingRef.current = playRing;
    }, [playRing]);

    // Derived state
    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Watch for token changes
    useEffect(() => {
        const checkToken = () => {
            const currentToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            if (currentToken && currentToken !== token) {
                console.log('🔑 Token detected in localStorage');
                setToken(currentToken);
            }
        };

        checkToken();

        const interval = setInterval(() => {
            if (!token) {
                checkToken();
            } else {
                clearInterval(interval);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [token]);

    // Helper: Create notification via API
    const createNotification = async (notificationData: Omit<Notification, '$id' | 'isRead'>): Promise<Notification | null> => {
        try {
            const currentToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            if (!currentToken) return null;

            const response = await fetch(`${API_BASE}/api/notifications/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify(notificationData)
            });

            if (response.ok) {
                const data = await response.json();
                return data.notification;
            }
            return null;
        } catch (error) {
            console.error('Failed to create notification:', error);
            return null;
        }
    };

    // Fetch notifications from API (all notifications for inbox)
    const fetchNotifications = async () => {
        try {
            const currentToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            if (!currentToken) return;

            // Fetch all notifications (not just unread) for inbox view
            const response = await fetch(`${API_BASE}/api/notifications?unreadOnly=false`, {
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const fetchedNotifications = data.notifications || [];
                console.log('📥 Fetched notifications:', fetchedNotifications.length);

                // Add fetched notification IDs to processedIds to prevent duplicates
                fetchedNotifications.forEach((notif: Notification) => {
                    if (notif.$id) {
                        processedIds.current.add(notif.$id);
                    }
                });

                setNotifications(fetchedNotifications);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    // Mark notification as read
    const markAsRead = async (id: string) => {
        try {
            const currentToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            if (!currentToken) return;

            const response = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });

            if (response.ok) {
                setNotifications(prev => prev.map(n => n.$id === id ? { ...n, isRead: true } : n));
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            const currentToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            if (!currentToken) return;

            const unreadIds = notifications.filter(n => !n.isRead).map(n => n.$id);
            await Promise.all(unreadIds.map(id => markAsRead(id)));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    // Delete notification (optimistic UI update + API call)
    const deleteNotification = async (id: string) => {
        try {
            // Optimistic update: Remove from state immediately
            setNotifications(prev => {
                const filtered = prev.filter(n => n.$id !== id);
                console.log(`🗑️  Deleted notification ${id} (${prev.length} → ${filtered.length} notifications)`);
                return filtered;
            });

            // Remove from processedIds to prevent re-adding
            processedIds.current.delete(id);

            // Call API endpoint to delete from database
            const currentToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            if (currentToken) {
                const response = await fetch(`${API_BASE}/api/notifications/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${currentToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Failed to delete notification' }));
                    console.error('❌ Failed to delete notification from database:', errorData);
                    // Revert on failure by refetching
                    await fetchNotifications();
                    throw new Error(errorData.error || 'Failed to delete notification');
                }

                console.log(`✅ Successfully deleted notification ${id} from database`);
            } else {
                console.warn('⚠️  No auth token found, notification deleted from UI only');
            }
        } catch (error) {
            console.error('Failed to delete notification:', error);
            // Revert on error by refetching
            await fetchNotifications();
        }
    };

    /**
     * CENTRALIZED NOTIFICATION HANDLER
     * Routes notifications to appropriate channels based on strict 3-channel architecture
     * 
     * Channel A: Toast Only (No DB) - Handled by AudioNotifications component
     * Channel B: Inbox + Toast (Persistent) - Save to DB + Toast + Sound
     * Channel C: Silent History (Inbox Only) - Save to DB only, no Toast/Sound
     */
    const handleIncomingNotification = async (
        notification: Notification,
        channel: NotificationChannel,
        options?: {
            showToast?: boolean;
            playSound?: boolean;
            showBrowserNotification?: boolean;
        }
    ) => {
        const notificationId = notification.$id;

        // GATEKEEPER: Check if already processed
        if (processedIds.current.has(notificationId)) {
            console.log(`🚫 [DEDUP] Ignoring duplicate notification: ${notificationId}`);
            return;
        }

        // Mark as processed immediately
        processedIds.current.add(notificationId);

        // Channel B: Inbox + Toast (Persistent)
        if (channel === 'B') {
            console.log(`📬 [CHANNEL B] Processing notification: ${notificationId} (${notification.type})`);

            // Add to notifications state (inbox)
            setNotifications(prev => {
                const exists = prev.some(n => n.$id === notificationId);
                if (exists) {
                    console.log(`⚠️  Notification ${notificationId} already in state, skipping`);
                    return prev;
                }
                return [notification, ...prev];
            });

            // Show toast + sound (if options allow)
            if (options?.playSound !== false) {
                playRingRef.current();
            }

            // Browser notification (if permission granted)
            if (options?.showBrowserNotification !== false && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('New Notification', {
                    body: notification.content,
                    icon: '/favicon.ico'
                });
            }
        }
        // Channel C: Silent History (Inbox Only)
        else if (channel === 'C') {
            console.log(`📋 [CHANNEL C] Processing silent notification: ${notificationId} (${notification.type})`);

            // CRITICAL: Channel C NEVER plays sounds, regardless of options

            // Add to notifications state (inbox) - NO toast/sound/browser notification
            setNotifications(prev => {
                const exists = prev.some(n => n.$id === notificationId);
                if (exists) {
                    console.log(`⚠️  Notification ${notificationId} already in state, skipping`);
                    return prev;
                }
                return [notification, ...prev];
            });

            // Explicitly do NOT play sounds, show toasts, or browser notifications
            // (Even if options.playSound === true, Channel C ignores it)
        }
        // Channel A: Should NOT be handled here (handled by AudioNotifications)
        else {
            console.warn(`⚠️  [CHANNEL A] Notification ${notificationId} should be handled by AudioNotifications component, not NotificationContext`);
        }
    };

    // Auto-cleanup: Remove oldest if > 100
    useEffect(() => {
        if (notifications.length > 100) {
            console.log(`🧹 Auto-cleanup: Removing oldest notifications (had ${notifications.length})`);
            const toRemove = notifications.slice(100);
            // Remove IDs from processedIds for removed notifications
            toRemove.forEach(notif => {
                processedIds.current.delete(notif.$id);
            });
            setNotifications(prev => prev.slice(0, 100));
        }
    }, [notifications.length]);

    // Initialize socket connection and listeners
    useEffect(() => {
        if (!token) {
            console.log('🔍 NotificationContext: Waiting for token...');
            return;
        }

        console.log('🔌 NotificationContext: Token found, initializing socket connection to:', SOCKET_URL);

        const newSocket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket'] // Force WebSocket to prevent polling quota leak
        });

        // Socket event handlers
        const handleConnect = () => {
            console.log('✅ Notification socket connected, ID:', newSocket.id);
            newSocket.emit('join_admin_feed');
            console.log('📤 Emitted join_admin_feed for notifications');
        };

        // ============================================
        // CHANNEL B: Inbox + Toast (Persistent)
        // ============================================

        const handleTicketCreated = async (data: any) => {
            const { ticketId, name, email, sessionId } = data || {};
            console.log('🎫 [CHANNEL B] ticket_created:', data);

            if (ticketId) {
                const notification = await createNotification({
                    type: 'ticket_created',
                    content: `New ticket created: ${ticketId}${name ? ` (${name})` : ''}`,
                    sessionId: sessionId || '',
                    targetUserId: null,
                    createdAt: new Date().toISOString()
                });

                if (notification) {
                    await handleIncomingNotification(notification, 'B', {
                        playSound: true,
                        showBrowserNotification: true
                    });
                }
            }
        };

        const handleRequestAgent = async (data: any) => {
            const { sessionId } = data || {};
            console.log('🔔 [CHANNEL B] request_agent:', data);

            if (sessionId) {
                const notification = await createNotification({
                    type: 'request_agent',
                    content: `Session ${sessionId} requested an agent`,
                    sessionId: sessionId,
                    targetUserId: null,
                    createdAt: new Date().toISOString()
                });

                if (notification) {
                    await handleIncomingNotification(notification, 'B', {
                        playSound: true,
                        showBrowserNotification: true
                    });
                }
            }
        };

        const handleSessionTimeoutWarning = async (data: any) => {
            const { sessionId, message } = data || {};
            console.log('⏰ [CHANNEL B] session_timeout_warning:', data);

            if (sessionId) {
                const notification = await createNotification({
                    type: 'session_timeout_warning',
                    content: message || `Session ${sessionId}: No agent response within 3 minutes`,
                    sessionId: sessionId,
                    targetUserId: null,
                    createdAt: new Date().toISOString()
                });

                if (notification) {
                    await handleIncomingNotification(notification, 'B', {
                        playSound: true,
                        showBrowserNotification: true
                    });
                }
            }
        };

        // Removed: Agent online/offline status notification handlers
        // These notifications are no longer created or displayed

        // Legacy: Listen for new_notification (from backend)
        const handleNewNotification = async (data: Notification) => {
            console.log('🔔 new_notification received:', data);

            // Filter out agent_connected/disconnected notifications (no longer supported)
            const type = data.type as string;
            if (type === 'agent_connected' || type === 'agent_disconnected') {
                console.log(`⏭️  Ignoring ${data.type} notification (agent status notifications removed)`);
                return;
            }

            // Route all other notifications to Channel B (with sound/toast)
            console.log(`📬 Routing ${data.type} to Channel B (with sound/toast)`);
            await handleIncomingNotification(data, 'B', {
                playSound: true,
                showBrowserNotification: true
            });
        };

        const handleDisconnect = () => {
            console.log('❌ Notification socket disconnected');
        };

        const handleConnectError = (error: any) => {
            console.error('❌ Notification socket connection error:', error);
        };

        // Register all event listeners
        newSocket.on('connect', handleConnect);
        newSocket.on('ticket_created', handleTicketCreated);
        newSocket.on('request_agent', handleRequestAgent);
        newSocket.on('session_timeout_warning', handleSessionTimeoutWarning);
        // Removed: agent_connected and agent_disconnected listeners (no longer supported)
        newSocket.on('new_notification', handleNewNotification);
        newSocket.on('disconnect', handleDisconnect);
        newSocket.on('connect_error', handleConnectError);

        setSocket(newSocket);

        // Fetch initial notifications (all, not just unread)
        console.log('📥 Fetching initial notifications...');
        fetchNotifications();

        // Cleanup: Remove all listeners and disconnect
        return () => {
            console.log('🔌 Disconnecting notification socket and removing listeners');
            newSocket.off('connect', handleConnect);
            newSocket.off('ticket_created', handleTicketCreated);
            newSocket.off('request_agent', handleRequestAgent);
            newSocket.off('session_timeout_warning', handleSessionTimeoutWarning);
            // Removed: agent_connected and agent_disconnected listeners (no longer supported)
            newSocket.off('new_notification', handleNewNotification);
            newSocket.off('disconnect', handleDisconnect);
            newSocket.off('connect_error', handleConnectError);
            newSocket.disconnect();
        };
    }, [token]);

    // Request browser notification permission on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const value: NotificationContextType = {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        fetchNotifications,
        deleteNotification
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
