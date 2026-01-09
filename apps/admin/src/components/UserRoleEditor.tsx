import React, { useState } from 'react';

interface UserRoleEditorProps {
  userId: string;
  currentRoles: string[];
  onSave: (roles: string[]) => Promise<void>;
  onCancel: () => void;
}

const AVAILABLE_ROLES = ['admin', 'agent'];

export default function UserRoleEditor({ userId, currentRoles, onSave, onCancel }: UserRoleEditorProps) {
  // Filter out invalid roles (super_admin, viewer) and only keep valid ones (admin, agent)
  const validCurrentRoles = currentRoles.filter(role => AVAILABLE_ROLES.includes(role));
  const [selectedRoles, setSelectedRoles] = useState<string[]>(validCurrentRoles.length > 0 ? validCurrentRoles : ['agent']);
  const [saving, setSaving] = useState(false);

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSave = async () => {
    // Ensure at least one role is selected
    if (selectedRoles.length === 0) {
      alert('Please select at least one role');
      return;
    }
    
    // Filter out any invalid roles just to be safe
    const validSelectedRoles = selectedRoles.filter(role => AVAILABLE_ROLES.includes(role));
    
    if (validSelectedRoles.length === 0) {
      alert('Please select at least one valid role');
      return;
    }
    
    setSaving(true);
    try {
      await onSave(validSelectedRoles);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Edit Roles</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">User ID: {userId}</p>
        
        <div className="space-y-2 mb-6">
          {AVAILABLE_ROLES.map(role => (
            <label key={role} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
                className="rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {role}
                {role === 'admin' && <span className="text-red-600 dark:text-red-400 ml-1">(all permissions)</span>}
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

