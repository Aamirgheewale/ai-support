import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, signout } = useAuth()
  const navigate = useNavigate()
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const handleLogout = async () => {
    try {
      await signout()
      onClose() // Close modal first
      navigate('/auth') // Redirect to auth page
    } catch (err) {
      console.error('Logout error:', err)
      // Still redirect even if logout fails
      onClose()
      navigate('/auth')
    }
  }

  // Focus trap and Esc key handler
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Focus close button on open
    setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 100)

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Get avatar initial
  const getInitials = (name: string, email: string): string => {
    if (name) {
      const parts = name.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  // Format date
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  if (!isOpen || !user) return null

  const initials = getInitials(user.name || '', user.email)
  const userMeta = (user as any).userMeta || {}

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={onClose}
          aria-hidden="true"
        ></div>

        {/* Modal panel */}
        <div
          ref={modalRef}
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-6">
              <h3 id="profile-modal-title" className="text-lg font-medium text-gray-900">User Profile</h3>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                aria-label="Close modal"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Avatar */}
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-semibold">
                {initials}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">User ID</label>
                <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                  {user.userId}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                  {user.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                  {user.name || 'N/A'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Roles</label>
                <div className="mt-1">
                  <div className="flex flex-wrap gap-2">
                    {user.roles && user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No roles assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {(user as any).createdAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Created At</label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                    {formatDate((user as any).createdAt)}
                  </div>
                </div>
              )}

              {(user as any).lastSeen && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Last Seen</label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                    {formatDate((user as any).lastSeen)}
                  </div>
                </div>
              )}

              {Object.keys(userMeta).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Additional Metadata</label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {JSON.stringify(userMeta, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse sm:gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm mb-2 sm:mb-0"
            >
              Logout
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

