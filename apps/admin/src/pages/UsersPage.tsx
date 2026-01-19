import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import UserAccessEditor from '../components/UserAccessEditor';
import PaginationControls from '../components/common/PaginationControls';
import { Card } from '../components/ui';
import DataTable from '../components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Check, X, Shield, Lock, UserPlus, Users as UsersIcon } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me';

interface User {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  permissions?: string[];
  status?: string;        // "online" | "offline"
  accountStatus?: string; // "active" | "pending" | "rejected"
  createdAt?: string;
  updatedAt?: string;
}

// Robust permission normalization helper
const normalizePermissions = (perms: any): string[] => {
  if (!perms) return [];
  if (Array.isArray(perms)) return perms;
  if (typeof perms === 'string') {
    try {
      const parsed = JSON.parse(perms);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      // Fallback for CSV strings if any
      return perms.split(',').map(p => p.trim()).filter(Boolean);
    }
  }
  return [];
};

export default function UsersPage() {
  const { hasRole, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'onboard'>('all');

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', roles: ['agent'] as string[] });
  const [creatingUser, setCreatingUser] = useState(false);

  // Pagination state
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);



  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email) {
      alert('Please enter both name and email');
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
        credentials: 'include',
        body: JSON.stringify({
          ...newUser,
          accountStatus: 'pending' // Force pending status
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create user');
      }

      const createdUser = await res.json();

      // Reset and refresh
      setNewUser({ email: '', name: '', roles: ['agent'] as string[] });
      setShowCreateModal(false);
      await loadUsers();
      await fetchPendingCount();

      alert(`User ${createdUser.name} created successfully!`);
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to create user'}`);
    } finally {
      setCreatingUser(false);
    }
  };

  useEffect(() => {
    loadUsers();
    fetchPendingCount();
  }, [offset, limit, activeTab]);

  const fetchPendingCount = async () => {
    try {
      console.log('Fetching pending count...');
      const res = await fetch(`${API_BASE}/admin/users?accountStatus=pending&limit=100`, {
        headers: { 'Authorization': `Bearer ${token || ADMIN_SECRET}` },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.items?.length || data.users?.length || 0;
        console.log('Pending count calculated:', count);
        setPendingCount(count);
      }
    } catch (e) { console.error('Failed to fetch pending count', e); }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      // Filter by accountStatus
      if (activeTab === 'onboard') {
        params.append('accountStatus', 'pending');
      } else {
        // Enforce strict filter for All Users tab (Active AND Rejected)
        params.append('accountStatus', 'active,rejected');
      }

      const res = await fetch(`${API_BASE}/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Failed to load users');

      const data = await res.json();
      setUsers(data.items || data.users || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccess = async (data: { roles: string[]; permissions: string[]; accountStatus: string }) => {
    if (!editingUser) return;

    try {
      const res = await fetch(`${API_BASE}/admin/users/${editingUser.userId}/access`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error('Failed to update access');

      setEditingUser(null);
      await loadUsers();
      await fetchPendingCount();
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to update access'}`);
    }
  };

  const handleQuickApprove = async (userId: string, approve: boolean) => {
    const accountStatus = approve ? 'active' : 'rejected';
    if (!confirm(`Are you sure you want to ${approve ? 'APPROVE' : 'REJECT'} this user?`)) return;

    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/access`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ accountStatus })
      });

      if (!res.ok) throw new Error('Failed to update status');
      await loadUsers();
      await fetchPendingCount();
    } catch (err: any) {
      alert(`Error: ${err?.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY DELETE this user? This action cannot be undone.')) return;

    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Failed to delete user');

      setEditingUser(null);
      await loadUsers();
      await fetchPendingCount();
      alert('User deleted successfully');
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to delete user'}`);
    }
  };

  // Columns for "All Users" Tab
  const allUserColumns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: info => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 dark:text-gray-100">{String(info.getValue() || 'Unknown')}</span>
          <span className="text-xs text-gray-500 capitalize">{info.row.original.accountStatus || 'active'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: info => <span className="text-gray-500 dark:text-gray-400">{String(info.getValue())}</span>,
    },
    {
      id: 'access',
      header: 'Access',
      cell: ({ row }) => {
        const u = row.original;
        const isAdmin = u.roles?.includes('admin');
        const permCount = normalizePermissions(u.permissions).length;

        return (
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                {permCount} Permissions
              </span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: info => {
        const val = info.getValue() as string | undefined;
        return <span className="text-gray-500 dark:text-gray-400">{val ? new Date(val).toLocaleDateString() : '-'}</span>;
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Manage</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <button
            onClick={() => setEditingUser(row.original)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-medium text-sm"
          >
            Manage Access
          </button>
        </div>
      ),
    },
  ];

  // Columns for "Onboard Agent" Tab
  const onboardColumns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: info => <span className="font-medium text-gray-900 dark:text-gray-100">{String(info.getValue() || 'Unknown')}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: info => <span className="text-gray-500 dark:text-gray-400">{String(info.getValue())}</span>,
    },
    {
      id: 'access',
      header: 'Access',
      cell: ({ row }) => {
        const u = row.original;
        const isAdmin = u.roles?.includes('admin');
        const isAgent = u.roles?.includes('agent');

        if (isAdmin) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              <Shield className="w-3 h-3 mr-1" />
              Admin
            </span>
          );
        }
        if (isAgent) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              Agent
            </span>
          );
        }
        return <span className="text-xs text-gray-400">User</span>;
      }
    },
    {
      accessorKey: 'createdAt',
      header: 'Requested',
      cell: info => {
        const val = info.getValue() as string | undefined;
        return <span className="text-gray-500 dark:text-gray-400">{val ? new Date(val).toLocaleDateString() : '-'}</span>;
      },
    },
    {
      id: 'permissions',
      header: 'Setup',
      cell: ({ row }) => (
        <button
          onClick={() => setEditingUser(row.original)}
          className="text-blue-600 hover:underline text-sm"
        >
          Add Permissions
        </button>
      )
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Decision</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleQuickApprove(row.original.userId, true)}
            className="p-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
            title="Approve"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleQuickApprove(row.original.userId, false)}
            className="p-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
            title="Reject"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage system access and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => { setActiveTab('all'); setOffset(0); }}
            className={`
                    whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                    ${activeTab === 'all'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:border-gray-300'}
                `}
          >
            <UsersIcon className="w-4 h-4" />
            All Users
          </button>
          <button
            onClick={() => { setActiveTab('onboard'); setOffset(0); }}
            className={`
                    whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                    ${activeTab === 'onboard'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:border-gray-300'}
                `}
          >
            <UserPlus className="w-4 h-4" />
            Onboard Agent
            {pendingCount > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 py-0.5 px-2 rounded-full text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={activeTab === 'all' ? allUserColumns : onboardColumns}
          data={users}
          isLoading={loading}
          showPagination={false}
        />

        {/* External Pagination Controls (Server-Side) */}
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


      {editingUser && (
        <UserAccessEditor
          userId={editingUser.userId}
          userName={editingUser.name}
          currentRoles={editingUser.roles || []}
          currentPermissions={normalizePermissions(editingUser.permissions)}
          currentAccountStatus={editingUser.accountStatus || 'active'}
          onSave={handleUpdateAccess}
          onDelete={() => handleDeleteUser(editingUser.userId)}
          onCancel={() => setEditingUser(null)}
        />
      )}

      {/* Simplified Create Modal for now (legacy compatible) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Create User</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={newUser.roles[0] || 'agent'}
                  onChange={e => setNewUser({ ...newUser, roles: [e.target.value] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Default role is Agent. Admins have full access.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creatingUser ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
