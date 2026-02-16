import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../context/NotificationContext'
import { ChevronDown } from 'lucide-react'
import NotificationBell from './NotificationBell'

import UserProfileMenu from './UserProfileMenu'
import LLMSettingsModal from '../modals/LLMSettingsModal'

type UserStatus = 'online' | 'away'

interface SidebarHeaderProps {
  isCollapsed?: boolean
  unreadCount?: number
}

/**
 * SidebarHeader - Slack/Linear-style header with user profile and notifications
 * Positioned at the top of the sidebar
 */
export default function SidebarHeader({ isCollapsed = false }: SidebarHeaderProps) {
  const { user } = useAuth()
  const { unreadCount } = useNotifications()

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isLLMSettingsOpen, setIsLLMSettingsOpen] = useState(false)
  const [hasOpenModal, setHasOpenModal] = useState(false)
  const [userStatus, setUserStatus] = useState<UserStatus>('online')
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Load and sync user status from localStorage
  useEffect(() => {
    if (!user) return

    // Initial load
    const storedStatus = localStorage.getItem(`user-status-${user.userId}`)
    if (storedStatus === 'online' || storedStatus === 'away') {
      setUserStatus(storedStatus)
    }

    // Listen for status changes from UserProfileMenu
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `user-status-${user.userId}` && e.newValue) {
        if (e.newValue === 'online' || e.newValue === 'away') {
          setUserStatus(e.newValue)
        }
      }
    }

    // Also listen for custom event for same-tab updates
    const handleStatusUpdate = () => {
      const newStatus = localStorage.getItem(`user-status-${user.userId}`)
      if (newStatus === 'online' || newStatus === 'away') {
        setUserStatus(newStatus)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('user-status-updated', handleStatusUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('user-status-updated', handleStatusUpdate)
    }
  }, [user])

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Ignore clicks inside the menu itself
      if (profileMenuRef.current && profileMenuRef.current.contains(target)) {
        return;
      }
      // Ignore clicks inside any open modal (portals)
      if (target.closest('[role="dialog"]')) {
        return;
      }

      setIsProfileMenuOpen(false)
    }

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isProfileMenuOpen])

  // Get user initials for avatar
  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  // Get first name from full name
  const getFirstName = (name?: string, email?: string): string => {
    if (name) {
      return name.split(' ')[0]
    }
    if (email) {
      return email.split('@')[0]
    }
    return 'User'
  }

  if (!user) return null

  const initials = getInitials(user.name, user.email)
  const firstName = getFirstName(user.name, user.email)

  return (
    <div className="relative top-0 z-[60]" ref={profileMenuRef}>
      {/* Header Container */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'justify-between px-4 py-3'} border-b border-gray-200/80`}>
        {/* User Profile Button */}
        <button
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className={`flex items-center group ${isCollapsed ? 'justify-center group/item hover:scale-110' : 'gap-2.5'} px-2 py-1.5 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 ease-in-out relative`}
          title={!isCollapsed ? (unreadCount > 0 ? `${unreadCount} Unread Notifications` : `${firstName} (${userStatus})`) : undefined}
        >
          {/* Square Avatar with Status Indicator */}
          <div className="relative">
            <div className={`${isCollapsed ? 'w-10 h-10' : 'w-10 h-10'} rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm transition-all duration-300 ease-in-out ${isCollapsed ? 'group-hover/item:scale-125' : ''}`}>
              {initials}
            </div>
            {/* Status Indicator Dot - Floating half outside avatar */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${userStatus === 'away' ? 'bg-yellow-500' : 'bg-green-500'
                }`}
              aria-label={userStatus === 'away' ? 'Away' : 'Online'}
            />
          </div>
          {/* First Name - Fade with CSS */}
          <span className={`text-medium font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            {firstName}
          </span>
          {/* Chevron */}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-4 opacity-100'} ${isProfileMenuOpen ? 'rotate-180' : ''}`}
          />
          {/* Enhanced tooltip when collapsed */}
          {isCollapsed && (
            <span className="absolute left-full ml-3 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-all duration-300 ease-in-out pointer-events-none z-50 border border-gray-700">
              <span className="font-semibold text-white">{firstName}</span>
              {unreadCount > 0 && (
                <span className="ml-1.5 text-blue-400 font-bold">{unreadCount} unread</span>
              )}
            </span>
          )}
        </button>

        {/* Notification Bell - Right (Hidden when collapsed) */}
        {!isCollapsed && <NotificationBell onOpenLLMSettings={() => setIsLLMSettingsOpen(true)} />}

        {/* Notification Badge when collapsed - Show on avatar (Slack-style at top-right corner) */}
        {isCollapsed && unreadCount > 0 && (
          <div className="absolute top-1 right-1">
            <span className="bg-blue-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white min-w-[16px] h-4 px-1 text-[10px] font-bold leading-tight mt-4">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </div>
        )}
      </div>

      {/* Backdrop with blur effect - only show when profile menu is open AND no modal is active */}
      {/* Note: Profile menu stays visible even when modals are open */}
      {isProfileMenuOpen && !hasOpenModal && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998]"
          onClick={() => setIsProfileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* User Profile Menu Popover */}
      {isProfileMenuOpen && (
        <UserProfileMenu
          onClose={() => setIsProfileMenuOpen(false)}
          onModalStateChange={setHasOpenModal}
          onOpenLLMSettings={() => setIsLLMSettingsOpen(true)}
        />
      )}

      {/* Global Modals */}
      {isLLMSettingsOpen && (
        <LLMSettingsModal
          isOpen={isLLMSettingsOpen}
          onClose={() => setIsLLMSettingsOpen(false)}
        />
      )}
    </div>
  )
}

