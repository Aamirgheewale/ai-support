import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import EditProfileModal from '../modals/EditProfileModal'
import GlobalSettingsModal from '../modals/GlobalSettingsModal'

interface UserProfileMenuProps {
  onClose: () => void
}

type UserStatus = 'online' | 'away'

/**
 * UserProfileMenu - Floating menu with identity, status, and settings
 */
export default function UserProfileMenu({ onClose }: UserProfileMenuProps) {
  const { user, updateUserStatus } = useAuth()
  const [status, setStatus] = useState<UserStatus>('online')
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const statusButtonRef = useRef<HTMLButtonElement>(null)
  const [statusMenuPosition, setStatusMenuPosition] = useState({ top: 0, left: 0 })

  // Load current status from user data or localStorage
  useEffect(() => {
    if (user) {
      // Check if status is stored in userMeta or localStorage
      const storedStatus = localStorage.getItem(`user-status-${user.userId}`)
      if (storedStatus === 'online' || storedStatus === 'away') {
        setStatus(storedStatus)
      }
    }
  }, [user])

  // Update status in database via useAuth hook
  const handleUpdateStatus = async (newStatus: UserStatus) => {
    if (!user || isUpdatingStatus) return

    setIsUpdatingStatus(true)
    
    // Optimistic update - update UI immediately
    setStatus(newStatus)
    localStorage.setItem(`user-status-${user.userId}`, newStatus)
    window.dispatchEvent(new CustomEvent('user-status-updated'))
    
    try {
      // Call the API via useAuth hook
      const success = await updateUserStatus(newStatus)
      
      if (!success) {
        console.warn('Failed to persist status to server, but local state updated')
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      // Status is already updated locally, so just log the error
    } finally {
      setIsUpdatingStatus(false)
      setIsStatusMenuOpen(false)
    }
  }

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

  // Get status indicator
  const getStatusIndicator = (userStatus: UserStatus) => {
    switch (userStatus) {
      case 'online':
        return { color: 'bg-green-500', label: 'Online', emoji: '🟢' }
      case 'away':
        return { color: 'bg-yellow-500', label: 'Away', emoji: '🟡' }
      default:
        return { color: 'bg-gray-400', label: 'Offline', emoji: '⚫' }
    }
  }

  // Calculate position for status menu when opening
  const handleStatusMenuToggle = () => {
    if (!isStatusMenuOpen && statusButtonRef.current) {
      const rect = statusButtonRef.current.getBoundingClientRect()
      setStatusMenuPosition({
        top: rect.top,
        left: rect.right + 8 // 8px gap to the right of the button
      })
    }
    setIsStatusMenuOpen(!isStatusMenuOpen)
  }

  if (!user) return null

  const initials = getInitials(user.name, user.email)
  const statusInfo = getStatusIndicator(status)
  const displayName = user.name || user.email

  return (
    <>
      {/* Menu Container - Fixed positioning with breathing room */}
      <div className="fixed left-3 top-[70px] w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999]">
        {/* Row 1: Identity - Spacious layout */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-start gap-4">
            {/* Large Avatar */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold shadow-md">
                {initials}
              </div>
              {/* Status dot on avatar */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${statusInfo.color} rounded-full border-2 border-white`} />
            </div>

            {/* Name and Edit Button - Stacked vertically */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <h4 className="text-base font-semibold text-gray-900 break-words leading-tight">
                {displayName}
              </h4>
              <button
                onClick={() => setIsEditProfileOpen(true)}
                className="self-start px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Status */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">{statusInfo.emoji}</span>
              <span className="text-sm font-medium text-gray-700">{statusInfo.label}</span>
            </div>

            {/* Status Menu Trigger */}
            <button
              ref={statusButtonRef}
              onClick={handleStatusMenuToggle}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Row 3: Settings */}
        <div className="px-2 py-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full px-3 py-2.5 flex items-center gap-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <span>Sounds & Notifications</span>
          </button>
        </div>
      </div>

      {/* Status Submenu - Fixed positioning to overflow outside sidebar */}
      {isStatusMenuOpen && (
        <div 
          className="fixed w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999]"
          style={{ top: statusMenuPosition.top, left: statusMenuPosition.left }}
        >
          <button
                    onClick={() => handleUpdateStatus('online')}
            className={`w-full px-3 py-2.5 flex items-center gap-2 text-sm hover:bg-gray-50 transition-colors ${status === 'online' ? 'bg-gray-50' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>Online</span>
            {status === 'online' && (
              <svg className="w-4 h-4 ml-auto text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <button
                    onClick={() => handleUpdateStatus('away')}
            className={`w-full px-3 py-2.5 flex items-center gap-2 text-sm hover:bg-gray-50 transition-colors ${status === 'away' ? 'bg-gray-50' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span>Away</span>
            {status === 'away' && (
              <svg className="w-4 h-4 ml-auto text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Modals */}
      {isEditProfileOpen && (
        <EditProfileModal 
          isOpen={isEditProfileOpen} 
          onClose={() => setIsEditProfileOpen(false)} 
        />
      )}

      {isSettingsOpen && (
        <GlobalSettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      )}
    </>
  )
}

