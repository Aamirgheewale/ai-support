import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function PermissionDeniedPage() {
  const navigate = useNavigate()

  const handleRequestHelp = () => {
    // Open mailto link or modal for requesting access
    const email = 'admin@example.com' // Replace with actual admin email
    const subject = 'Request for Super Admin Access'
    const body = 'I would like to request access to the Users management tab.'
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600 mb-6">
          Super admin only — you do not have permission to view this tab.
        </p>
        <div className="space-y-3">
          <button
            onClick={handleRequestHelp}
            className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Request Access
          </button>
          <button
            onClick={() => navigate('/sessions')}
            className="w-full bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Go to Sessions
          </button>
        </div>
      </div>
    </div>
  )
}

