import { useState, useEffect, useRef } from 'react'
import { Loader2, User, Shield, Bell, Settings, Key, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../context/ThemeContext'
import Modal from '../ui/Modal'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'profile' | 'security' | 'notifications' | 'preferences' | 'api'

/**
 * EditProfileModal - Modal for editing user profile settings
 */
export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, refreshMe } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  // Profile State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    marketing: false,
    security: true,
    updates: true,
    comments: true,
    mentions: true,
    tasks: true
  })

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')

      // Parse notification settings from user.prefs
      if (user.prefs) {
        try {
          const prefs = typeof user.prefs === 'string' ? JSON.parse(user.prefs) : user.prefs
          setNotificationSettings({
            marketing: prefs.marketing ?? false,
            security: prefs.security ?? true,
            updates: prefs.updates ?? true,
            comments: prefs.comments ?? true,
            mentions: prefs.mentions ?? true,
            tasks: prefs.tasks ?? true
          })
        } catch (e) {
          console.error('Failed to parse user prefs:', e)
        }
      }
    }
  }, [user])

  // Reset tab on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('profile')
      setSuccess(false)
      setError(null)
    }
  }, [isOpen])

  // Handle notification toggle
  const handleNotificationChange = (key: string, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  // Handle save (Context-aware for Profile and Notifications)
  const handleSave = async () => {
    if (!user) return

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
      if (!token) {
        throw new Error('Not authenticated')
      }

      let requestBody: any = {}

      // Context-aware save logic
      if (activeTab === 'profile') {
        requestBody = { name, email }
      } else if (activeTab === 'notifications') {
        // Convert notification settings to JSON string for prefs field
        requestBody = { prefs: JSON.stringify(notificationSettings) }
      } else {
        // No save logic for other tabs yet
        return
      }

      const response = await fetch(`${API_BASE}/users/${user.userId}/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update')
      }

      // Refresh user data
      await refreshMe()
      setSuccess(true)

      // Close after short delay
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to update')
    } finally {
      setIsSaving(false)
    }
  }

  // Get user initials for avatar
  const getInitials = (userName?: string, userEmail?: string): string => {
    if (userName) {
      const parts = userName.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return userName.substring(0, 2).toUpperCase()
    }
    if (userEmail) {
      return userEmail.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  if (!isOpen) return null

  const { theme, setTheme } = useTheme()
  const initials = getInitials(name, email)

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Avatar Preview */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold shadow-lg">
                {initials}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* User ID (read-only) */}
              <div>
                <label htmlFor="userId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  id="userId"
                  value={user?.userId || ''}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
                  disabled
                  readOnly
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">User ID cannot be changed</p>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Enter your email"
                  disabled // Email is typically not editable
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Email cannot be changed</p>
              </div>

              {/* Roles (read-only) */}
              {user?.roles && user.roles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Roles
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="px-3 py-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">Profile updated successfully!</p>
              </div>
            )}
          </div>
        )

      case 'security':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-800">Change Password</h3>

              <div className="space-y-4">
                <input type="password" placeholder="Current Password" className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                <input type="password" placeholder="New Password" className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                <input type="password" placeholder="Confirm New Password" className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">Update Password</button>
              </div>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-800">Email Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Marketing Emails</span>
                <button
                  onClick={() => handleNotificationChange('marketing', !notificationSettings.marketing)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationSettings.marketing ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationSettings.marketing ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Security Alerts</span>
                <button
                  onClick={() => handleNotificationChange('security', !notificationSettings.security)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationSettings.security ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationSettings.security ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Ticket Updates</span>
                <button
                  onClick={() => handleNotificationChange('updates', !notificationSettings.updates)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationSettings.updates ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationSettings.updates ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </div>

            <h3 className="text-sm font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-800 pt-4">System Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">New Comment</span>
                <button
                  onClick={() => handleNotificationChange('comments', !notificationSettings.comments)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationSettings.comments ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationSettings.comments ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Mentioned</span>
                <button
                  onClick={() => handleNotificationChange('mentions', !notificationSettings.mentions)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationSettings.mentions ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationSettings.mentions ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Task Assigned</span>
                <button
                  onClick={() => handleNotificationChange('tasks', !notificationSettings.tasks)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationSettings.tasks ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationSettings.tasks ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )

      case 'preferences':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center px-4 py-3 border rounded-lg transition ${theme === 'light'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500/50 ring-1 ring-indigo-500/50'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white'
                    }`}
                >
                  <span className="text-sm font-medium">Light</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center px-4 py-3 border rounded-lg transition ${theme === 'dark'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500/50 ring-1 ring-indigo-500/50'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white'
                    }`}
                >
                  <span className="text-sm font-medium">Dark</span>
                </button>
                <button
                  onClick={() => {
                    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
                    setTheme(systemDark ? 'dark' : 'light')
                  }}
                  className="flex items-center justify-center px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-900 dark:text-white"
                >
                  <span className="text-sm font-medium">System</span>
                </button>
              </div>
            </div>


          </div>
        )

      case 'api':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 p-4 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-300 flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                Your API key grants full access to your account. Keep it secure!
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Active API Key</label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 font-mono text-sm flex items-center justify-between">
                  <span>sk_live_**********************xy9z</span>
                  <button className="text-gray-400 hover:text-gray-600"><EyeOff className="w-4 h-4" /></button>
                </div>
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition">Regenerate</button>
              </div>
              <p className="mt-2 text-xs text-gray-500">Last used: 2 minutes ago</p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Account Settings"
      maxWidth="max-w-2xl"
      noPadding={true}
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 pt-2 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'profile'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
        >
          <User className="w-4 h-4" />
          Profile
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'security'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
        >
          <Shield className="w-4 h-4" />
          Security
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'notifications'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
        >
          <Bell className="w-4 h-4" />
          Notifications
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'preferences'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
        >
          <Settings className="w-4 h-4" />
          Preferences
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'api'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
        >
          <Key className="w-4 h-4" />
          API Keys
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-6 bg-white dark:bg-gray-900 min-h-[400px]">
        {renderContent()}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Close
        </button>
        {(activeTab === 'profile' || activeTab === 'notifications') && (
          <button
            onClick={handleSave}
            disabled={isSaving || (activeTab === 'profile' && !name.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        )}
      </div>
    </Modal>
  )
}
