import React from 'react'

export const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'viewer', label: 'Viewer' }
]

interface RoleDropdownProps {
  value: string
  onChange: (value: string) => void
  showLabel?: boolean
  disabled?: boolean
}

export default function RoleDropdown({ value, onChange, showLabel = true, disabled = false }: RoleDropdownProps) {
  return (
    <div>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Role <span className="text-red-500">*</span>
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed border-gray-300"
        required
      >
        {ROLE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

