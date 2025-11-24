import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import UserRoleEditor from '../components/UserRoleEditor';
import PaginationControls from '../components/common/PaginationControls';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me';

interface User {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  createdAt?: string;
  updatedAt?: string;
}

export default function UsersPage() {
  const { hasRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', roles: [] as string[] });
  
  // Pagination state
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Check if user has super_admin role
  if (!hasRole('super_admin')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Access denied. Super admin role required.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadUsers();
  }, [offset, limit]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });
      
      const res = await fetch(`${API_BASE}/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to load users');
      }

      const data = await res.json();
      setUsers(data.items || data.users || []);
      setTotal(data.total || 0);
      setHasMore(data.hasMore !== undefined ? data.hasMore : (offset + (data.items || data.users || []).length < data.total));
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(`Are you sure you want to delete user ${userId}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to delete user');
      }

      await loadUsers();
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to delete user'}`);
    }
  };

  const handleSaveRoles = async (roles: string[]) => {
    if (!editingUser) return;

    try {
      const res = await fetch(`${API_BASE}/admin/users/${editingUser.userId}/roles`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roles })
      });

      if (!res.ok) {
        throw new Error('Failed to update roles');
      }

      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to update roles'}`);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email) {
      alert('Email is required');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create user');
      }

      setShowCreateModal(false);
      setNewUser({ email: '', name: '', roles: [] });
      await loadUsers();
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to create user'}`);
    }
  };

  const toggleNewUserRole = (role: string) => {
    if (newUser.roles.includes(role)) {
      setNewUser({ ...newUser, roles: newUser.roles.filter(r => r !== role) });
    } else {
      setNewUser({ ...newUser, roles: [...newUser.roles, role] });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading users...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.userId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <span
                            key={role}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit Roles
                      </button>
                      <button
                        onClick={() => handleDelete(user.userId)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* Pagination */}
          {!loading && users.length > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700">Items per page:</label>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setOffset(0);
                  }}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <PaginationControls
                total={total}
                limit={limit}
                offset={offset}
                onPageChange={(newOffset) => setOffset(newOffset)}
              />
            </div>
          )}
        </div>
      )}

      {editingUser && (
        <UserRoleEditor
          userId={editingUser.userId}
          currentRoles={editingUser.roles}
          onSave={handleSaveRoles}
          onCancel={() => setEditingUser(null)}
        />
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Create User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                  placeholder="User Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Roles
                </label>
                <div className="space-y-2">
                  {['super_admin', 'admin', 'agent', 'viewer'].map((role) => (
                    <label key={role} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newUser.roles.includes(role)}
                        onChange={() => toggleNewUserRole(role)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUser({ email: '', name: '', roles: [] });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

