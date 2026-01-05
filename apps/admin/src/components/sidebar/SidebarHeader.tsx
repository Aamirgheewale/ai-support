import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import NotificationBell from './NotificationBell'
import UserProfileMenu from './UserProfileMenu'

type UserStatus = 'online' | 'away'

/**
 * SidebarHeader - Slack/Linear-style header with user profile and notifications
 * Positioned at the top of the sidebar
 */
export default function SidebarHeader() {
  const { user } = useAuth()
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
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
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
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
    <div className="relative" ref={profileMenuRef}>
      {/* Header Container */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/80">
        {/* User Profile Button - Left */}
        <button
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className="flex items-center gap-2.5 px-2 py-1.5 -ml-2 rounded-lg hover:bg-gray-100 transition-all duration-150 group"
        >
          {/* Square Avatar with Status Indicator */}
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
              {initials}
            </div>
            {/* Status Indicator Dot - Floating half outside avatar */}
            <span 
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                userStatus === 'away' ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              aria-label={userStatus === 'away' ? 'Away' : 'Online'}
            />
          </div>
          {/* First Name */}
          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
            {firstName}
          </span>
          {/* Chevron */}
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Notification Bell - Right */}
        <NotificationBell />
      </div>

      {/* User Profile Menu Popover */}
      {isProfileMenuOpen && (
        <UserProfileMenu onClose={() => setIsProfileMenuOpen(false)} />
      )}
    </div>
  )
}

