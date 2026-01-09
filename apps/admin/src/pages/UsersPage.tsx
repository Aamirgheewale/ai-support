import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import UserRoleEditor from '../components/UserRoleEditor';
import PaginationControls from '../components/common/PaginationControls';
import { Card, TableContainer, Table, Thead, Th, Tbody, Tr, Td } from '../components/ui';

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
  const { hasRole, token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', roles: [] as string[] });
  const [creatingUser, setCreatingUser] = useState(false);
  
  // Pagination state
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Check if user has admin role
  if (!hasRole('admin')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Access denied. Admin role required.</p>
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
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include' // Include cookies as fallback
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
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include' // Include cookies as fallback
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
          'Authorization': `Bearer ${token || ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies as fallback
        body: JSON.stringify({ roles })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update roles' }));
        throw new Error(errorData.error || 'Failed to update roles');
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

    setCreatingUser(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies as fallback
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
    } finally {
      setCreatingUser(false);
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-700 dark:text-gray-300">Loading users...</div>
      ) : (
        <Card className="overflow-hidden">
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Roles</Th>
                  <Th>Created</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="text-center text-gray-500 dark:text-gray-400">
                      No users found
                    </Td>
                  </Tr>
                ) : (
                  users.map((user) => (
                    <Tr key={user.userId}>
                      <Td className="font-medium">{user.name}</Td>
                      <Td className="text-gray-500 dark:text-gray-400">{user.email}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </Td>
                      <Td className="text-gray-500 dark:text-gray-400">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                      </Td>
                      <Td className="text-right">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-4"
                        >
                          Edit Roles
                        </button>
                        <button
                          onClick={() => handleDelete(user.userId)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </TableContainer>
          
          {/* Pagination */}
          {!loading && users.length > 0 && (
            <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700 dark:text-gray-300">Items per page:</label>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setOffset(0);
                  }}
                  className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
        </Card>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Create User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="User Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Roles
                </label>
                <div className="space-y-2">
                  {['admin', 'agent'].map((role) => (
                    <label key={role} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newUser.roles.includes(role)}
                        onChange={() => toggleNewUserRole(role)}
                        className="rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{role}</span>
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
                  setCreatingUser(false);
                }}
                disabled={creatingUser}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed relative transition-all"
                style={{
                  animation: creatingUser ? 'bounce 0.6s ease-in-out infinite' : 'none',
                  transform: creatingUser ? 'translateY(0)' : 'none'
                }}
              >
                {creatingUser ? (
                  <span className="flex items-center justify-center">
                    <span className="mr-2">Creating</span>
                    <span className="flex space-x-1">
                      <span 
                        className="inline-block w-2 h-2 bg-white rounded-full"
                        style={{ 
                          animation: 'pulse 1.4s ease-in-out infinite',
                          animationDelay: '0s'
                        }}
                      ></span>
                      <span 
                        className="inline-block w-2 h-2 bg-white rounded-full"
                        style={{ 
                          animation: 'pulse 1.4s ease-in-out infinite',
                          animationDelay: '0.2s'
                        }}
                      ></span>
                      <span 
                        className="inline-block w-2 h-2 bg-white rounded-full"
                        style={{ 
                          animation: 'pulse 1.4s ease-in-out infinite',
                          animationDelay: '0.4s'
                        }}
                      ></span>
                    </span>
                  </span>
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

