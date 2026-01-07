import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../context/NotificationContext'
import { useSoundContext } from '../../context/SoundContext'
import NotificationItem from './NotificationItem'

type TabType = 'all' | 'unread'

/**
 * NotificationBell - World Class Inbox-style notification system
 * Features:
 * - Sticky header with tabs (All | Unread)
 * - Modern inbox UI
 * - Mark all as read
 */
export default function NotificationBell() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications()
  const { playNotificationPop } = useSoundContext()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [prevCount, setPrevCount] = useState(unreadCount)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Play pop sound when notification count increases
  useEffect(() => {
    if (unreadCount > prevCount && prevCount !== 0) {
      playNotificationPop()
    }
    setPrevCount(unreadCount)
  }, [unreadCount, prevCount, playNotificationPop])

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle hover to open popover
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(true)
    }, 200)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 300)
  }

  const handlePopoverMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
  }

  const handlePopoverMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200)
  }

  // Filter notifications based on active tab
  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    await markAllAsRead()
  }

  // View all notifications
  const handleViewAll = () => {
    setIsOpen(false)
    navigate('/notifications')
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="w-5 h-5 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Blue Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-blue-500 rounded-full shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover - Fixed positioning to avoid sidebar clipping */}
      {isOpen && (
        <div
          ref={popoverRef}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          className="fixed left-[260px] top-4 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-[9999] overflow-hidden flex flex-col max-h-[600px]"
        >
          {/* Sticky Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'all'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab('unread')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'unread'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Unread
                {unreadCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-blue-500 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm text-gray-500 text-center">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                </p>
              </div>
            ) : (
              filteredNotifications.slice(0, 20).map((notification) => (
                <NotificationItem
                  key={notification.$id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))
            )}
          </div>

          {/* Footer - View All link */}
          {notifications.length > 20 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={handleViewAll}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                View all ({notifications.length} notifications)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
