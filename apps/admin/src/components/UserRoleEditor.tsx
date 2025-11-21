import React, { useState } from 'react';

interface UserRoleEditorProps {
  userId: string;
  currentRoles: string[];
  onSave: (roles: string[]) => Promise<void>;
  onCancel: () => void;
}

const AVAILABLE_ROLES = ['super_admin', 'admin', 'agent', 'viewer'];

export default function UserRoleEditor({ userId, currentRoles, onSave, onCancel }: UserRoleEditorProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(currentRoles);
  const [saving, setSaving] = useState(false);

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedRoles);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Edit Roles</h2>
        <p className="text-sm text-gray-600 mb-4">User ID: {userId}</p>
        
        <div className="space-y-2 mb-6">
          {AVAILABLE_ROLES.map(role => (
            <label key={role} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">
                {role}
                {role === 'super_admin' && <span className="text-red-600 ml-1">(all permissions)</span>}
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

