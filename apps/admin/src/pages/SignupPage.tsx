import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Card } from '../components/ui'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' }
]

export default function SignupPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['admin'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  if (!hasRole('admin')) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Access denied. Admin role required.</p>
        </div>
      </div>
    )
  }

  const handleRoleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map(option => option.value)
    setSelectedRoles(values)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (selectedRoles.length === 0) {
      setError('Select at least one role')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          roles: selectedRoles
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create user')
      }

      setSuccess('User created successfully')
      setEmail('')
      setName('')
      setSelectedRoles(['admin'])

      setTimeout(() => {
        navigate('/users')
      }, 1000)
    } catch (err: any) {
      setError(err?.message || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New User</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Invite a teammate to the admin portal.</p>
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-200">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="user@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="User name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Roles <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <select
              multiple
              value={selectedRoles}
              onChange={handleRoleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {ROLE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Hold Ctrl (Cmd on Mac) to select multiple roles.</p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

