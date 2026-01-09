import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * EditProfileModal - Modal for editing user profile settings
 */
export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, refreshMe } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
    }
  }, [user])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Handle save
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

      const response = await fetch(`${API_BASE}/users/${user.userId}/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update profile')
      }

      // Refresh user data
      await refreshMe()
      setSuccess(true)
      
      // Close after short delay
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
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

  const initials = getInitials(name, email)

  return (
    <div 
      className="fixed inset-0 z-[10000] overflow-y-auto" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop - below profile menu, no blur (profile menu backdrop already provides blur) */}
      <div className="fixed inset-0 bg-black/50 z-[10000]" onClick={onClose} />

      {/* Modal Container - above profile menu */}
      <div className="flex items-center justify-center min-h-screen p-4 relative z-[10002]">
        <div
          ref={modalRef}
          className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account Settings</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400 dark:hover:text-gray-200" />
            </button>
          </div>

          {/* Tabs (single tab for now) */}
          <div className="px-6 py-2 border-b border-gray-100 dark:border-gray-700">
            <button className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400">
              Profile
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Avatar Preview */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold shadow-lg">
                {initials}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
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
          </div>
        </div>
      </div>
    </div>
  )
}

