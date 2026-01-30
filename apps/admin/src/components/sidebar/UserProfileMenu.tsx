import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../context/ThemeContext'
import EditProfileModal from '../modals/EditProfileModal'
import GlobalSettingsModal from '../modals/GlobalSettingsModal'
import CannedResponsesModal from '../modals/CannedResponsesModal'
import LLMSettingsModal from '../modals/LLMSettingsModal'
import SystemPromptModal from '../modals/SystemPromptModal'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Palette, Loader2, MoreVertical, Volume2, MessageSquare, Check, Cpu, Terminal } from 'lucide-react'

interface UserProfileMenuProps {
  onClose: () => void
  onModalStateChange?: (hasOpenModal: boolean) => void
  onOpenLLMSettings: () => void
}

type UserStatus = 'online' | 'away'

/**
 * UserProfileMenu - Floating menu with identity, status, and settings
 */
export default function UserProfileMenu({ onClose, onModalStateChange, onOpenLLMSettings }: UserProfileMenuProps) {
  const { user, updateUserStatus, hasRole, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [status, setStatus] = useState<UserStatus>('online')
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCannedResponsesOpen, setIsCannedResponsesOpen] = useState(false)
  const [isSystemPromptOpen, setSystemPromptOpen] = useState(false)
  // Local LLM settings state removed - now controlled by parent
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const statusButtonRef = useRef<HTMLButtonElement>(null)
  const themeButtonRef = useRef<HTMLButtonElement>(null)
  const [statusMenuPosition, setStatusMenuPosition] = useState({ top: 0, left: 0 })
  const [themeMenuPosition, setThemeMenuPosition] = useState({ top: 0, left: 0 })

  // Track if any modal is open and notify parent
  // We don't track isLLMSettingsOpen here anymore as it's lifted
  const hasOpenModal = isEditProfileOpen || isSettingsOpen || isCannedResponsesOpen || isSystemPromptOpen

  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(hasOpenModal)
    }
  }, [hasOpenModal, onModalStateChange])

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
        left: rect.right - 10 // 8px gap to the right of the button
      })
    }
    setIsStatusMenuOpen(!isStatusMenuOpen)
  }

  // Calculate position for theme menu when opening
  const handleThemeMenuToggle = () => {
    if (!isThemeMenuOpen && themeButtonRef.current) {
      const rect = themeButtonRef.current.getBoundingClientRect()
      setThemeMenuPosition({
        top: rect.top,
        left: rect.right - 10 // 8px gap to the right of the button
      })
    }
    setIsThemeMenuOpen(!isThemeMenuOpen)
  }

  if (!user) return null

  const initials = getInitials(user.name, user.email)
  const statusInfo = getStatusIndicator(status)
  const displayName = user.name || user.email

  return (
    <>
      {/* Menu Container - Fixed positioning with breathing room */}
      {/* Higher z-index to stay above modal backdrops but below modal content */}
      <div className="fixed left-3 top-[70px] w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-[9999]">
        {/* Row 1: Identity - Spacious layout */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-start gap-4">
            {/* Large Avatar */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold shadow-md">
                {initials}
              </div>
              {/* Status dot on avatar */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${statusInfo.color} rounded-full border-2 border-white dark:border-gray-800`} />
            </div>

            {/* Name and Edit Button - Stacked vertically */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white break-words leading-tight">
                {displayName}
              </h4>
              <button
                onClick={() => {
                  // Close other modals first
                  setIsSettingsOpen(false)
                  setIsCannedResponsesOpen(false)
                  // Open profile modal locally
                  setIsEditProfileOpen(true)
                }}
                className="self-start px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 rounded transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Status */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">{statusInfo.emoji}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusInfo.label}</span>
            </div>

            {/* Status Menu Trigger */}
            <button
              ref={statusButtonRef}
              onClick={handleStatusMenuToggle}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              ) : (
                <MoreVertical className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Row 3: Settings */}
        <div className="px-2 py-2 space-y-1">
          <button
            onClick={() => {
              // Close other modals first
              setIsEditProfileOpen(false)
              setIsCannedResponsesOpen(false)
              setSystemPromptOpen(false)
              setIsSettingsOpen(true)
            }}
            className="w-full px-3 py-2.5 flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Volume2 className="w-5 h-5 text-gray-400" />
            <span>Sounds & Notifications</span>
          </button>

          {/* AI Configuration - Admins only */}
          {(user?.roles?.includes('admin') || hasRole('admin')) && (
            <>
              <button
                onClick={() => {
                  // Close other modals first
                  setIsEditProfileOpen(false)
                  setIsSettingsOpen(false)
                  setIsCannedResponsesOpen(false)
                  setSystemPromptOpen(false)
                  // Use prop to open global modal
                  onOpenLLMSettings()
                }}
                className="w-full px-3 py-2.5 flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Cpu className="w-5 h-5 text-gray-400" />
                <span>AI Configuration</span>
              </button>

              <button
                onClick={() => {
                  setIsEditProfileOpen(false)
                  setIsSettingsOpen(false)
                  setIsCannedResponsesOpen(false)
                  setSystemPromptOpen(true)
                }}
                className="w-full px-3 py-2.5 flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Terminal className="w-5 h-5 text-gray-400" />
                <span>System Prompt</span>
              </button>
            </>
          )}

          {/* Canned Responses - visible to admin/agent */}
          {(hasRole('admin') || hasRole('agent')) && (
            <button
              onClick={() => {
                // Close other modals first
                setIsEditProfileOpen(false)
                setIsSettingsOpen(false)
                setSystemPromptOpen(false)
                setIsCannedResponsesOpen(true)
              }}
              className="w-full px-3 py-2.5 flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MessageSquare className="w-5 h-5 text-gray-400" />
              <span>Canned Responses</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            ref={themeButtonRef}
            onClick={handleThemeMenuToggle}
            className="w-full px-3 py-2.5 flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Palette className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <span>Theme</span>
          </button>
        </div>
      </div>

      {/* Status Submenu - Fixed positioning to overflow outside sidebar */}
      {isStatusMenuOpen && (
        <div
          className="fixed w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[10002]"
          style={{ top: statusMenuPosition.top, left: statusMenuPosition.left }}
        >
          <button
            onClick={() => handleUpdateStatus('online')}
            className={`w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${status === 'online' ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>Online</span>
            {status === 'online' && (
              <Check className="w-4 h-4 ml-auto text-green-600" />
            )}
          </button>
          <button
            onClick={() => handleUpdateStatus('away')}
            className={`w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${status === 'away' ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span>Away</span>
            {status === 'away' && (
              <Check className="w-4 h-4 ml-auto text-yellow-600" />
            )}
          </button>
        </div>
      )}

      {/* Theme Submenu - Fixed positioning to overflow outside sidebar */}
      {isThemeMenuOpen && (
        <div
          className="fixed w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[10002]"
          style={{ top: themeMenuPosition.top, left: themeMenuPosition.left }}
        >
          <button
            onClick={() => {
              setTheme('light')
              setIsThemeMenuOpen(false)
            }}
            className={`w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${theme === 'light' ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
          >
            <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-yellow-500' : 'text-gray-400'}`} />
            <span>Light</span>
            {theme === 'light' && (
              <Check className="w-4 h-4 ml-auto text-yellow-600" />
            )}
          </button>
          <button
            onClick={() => {
              setTheme('dark')
              setIsThemeMenuOpen(false)
            }}
            className={`w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${theme === 'dark' ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
          >
            <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-500' : 'text-gray-400'}`} />
            <span>Dark</span>
            {theme === 'dark' && (
              <Check className="w-4 h-4 ml-auto text-blue-600" />
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

      {isCannedResponsesOpen && (
        <CannedResponsesModal
          isOpen={isCannedResponsesOpen}
          onClose={() => setIsCannedResponsesOpen(false)}
        />
      )}

      {isSystemPromptOpen && (
        <SystemPromptModal
          isOpen={isSystemPromptOpen}
          onClose={() => setSystemPromptOpen(false)}
        />
      )}

    </>
  )
}
