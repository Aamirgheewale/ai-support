import { useNavigate } from 'react-router-dom'

interface NotificationItemProps {
  notification: {
    $id: string
    type: 'request_agent' | 'assignment' | 'ticket_created' | 'session_timeout_warning' | 'agent_connected' | 'agent_disconnected'
    content: string
    sessionId: string
    isRead: boolean
    createdAt?: string
    $createdAt?: string
  }
  onMarkAsRead: (id: string) => void
  onDelete?: (id: string) => void
}

/**
 * NotificationItem - Individual notification item in inbox
 */
export default function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const navigate = useNavigate()

  // Format relative time
  const formatTimeAgo = (dateString?: string): string => {
    if (!dateString) return 'Just now'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Get icon and styling based on type
  const getNotificationConfig = () => {
    switch (notification.type) {
      case 'request_agent':
        return {
          icon: (
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          ),
          title: 'Agent Request',
          bgColor: 'bg-orange-50'
        }
      case 'ticket_created':
        return {
          icon: (
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          ),
          title: 'New Ticket',
          bgColor: 'bg-purple-50'
        }
      case 'session_timeout_warning':
        return {
          icon: (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          ),
          title: 'Session Timeout',
          bgColor: 'bg-amber-50'
        }
      case 'agent_connected':
        return {
          icon: (
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          ),
          title: 'Agent Online',
          bgColor: 'bg-green-50'
        }
      case 'agent_disconnected':
        return {
          icon: (
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          ),
          title: 'Agent Offline',
          bgColor: 'bg-red-50'
        }
      case 'assignment':
        return {
          icon: (
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          ),
          title: 'Assignment',
          bgColor: 'bg-blue-50'
        }
      default:
        return {
          icon: (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
          ),
          title: 'Notification',
          bgColor: 'bg-gray-50'
        }
    }
  }

  const config = getNotificationConfig()
  const timeAgo = formatTimeAgo(notification.createdAt || notification.$createdAt)

  // Handle click
  const handleClick = async () => {
    if (!notification.isRead) {
      await onMarkAsRead(notification.$id)
    }

    // Navigate based on type
    if (notification.type === 'ticket_created') {
      navigate('/pending-queries')
    } else if (notification.sessionId) {
      navigate(`/sessions/${notification.sessionId}`)
    }
  }

  // Handle delete
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering handleClick
    if (onDelete) {
      onDelete(notification.$id)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative w-full p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0 cursor-pointer ${!notification.isRead ? config.bgColor : ''
        }`}
    >
      {/* Icon */}
      {config.icon}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{config.title}</p>
              {!notification.isRead && (
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2 break-words">
              {notification.content}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {timeAgo}
            </span>
            {/* Delete button - shows on hover */}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all"
                title="Remove notification"
              >
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

