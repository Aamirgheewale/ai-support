import React, { useState, useEffect } from 'react';
import { Shield, Check, X, AlertTriangle, Trash2 } from 'lucide-react';

interface UserAccessEditorProps {
    userId: string;
    userName?: string;
    currentRoles: string[];
    currentPermissions: string[];
    currentAccountStatus: string;
    onSave: (data: { roles: string[]; permissions: string[]; accountStatus: string }) => Promise<void>;
    onDelete?: () => void;
    onCancel: () => void;
}

const AVAILABLE_PERMISSIONS = [
    { id: 'dashboard', label: 'Dashboard', description: 'View improved statistics' },
    { id: 'sessions', label: 'Sessions', description: 'Access chat sessions' },
    { id: 'live', label: 'Live View', description: 'Monitor live visitors' },
    { id: 'users', label: 'User Management', description: 'Manage agents and users' },
    { id: 'agents_online', label: 'Agents Online', description: 'View online agents status' },
    { id: 'pending_queries', label: 'Pending Queries', description: 'Manage pending chat queries' },
    { id: 'analytics', label: 'Analytics', description: 'View detailed analytics' },
    { id: 'accuracy', label: 'Accuracy', description: 'Manage AI accuracy' },
    { id: 'encryption', label: 'Encryption', description: 'Manage security keys' },
    { id: 'notifications', label: 'Notifications', description: 'Receive system alerts' },
    { id: 'agent_inbox', label: 'Agent Inbox', description: 'Access personal agent inbox' },
];

export default function UserAccessEditor({
    userId,
    userName,
    currentRoles,
    currentPermissions,
    currentAccountStatus,
    onSave,
    onDelete,
    onCancel
}: UserAccessEditorProps) {
    const [isAdmin, setIsAdmin] = useState(currentRoles.includes('admin'));
    const [permissions, setPermissions] = useState<string[]>(() => {
        // Handle both string (serialized JSON) and array formats
        if (Array.isArray(currentPermissions)) return currentPermissions;
        if (typeof currentPermissions === 'string') {
            try {
                const parsed = JSON.parse(currentPermissions);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.error('Failed to parse permissions:', e);
                return [];
            }
        }
        return [];
    });
    const [accountStatus, setAccountStatus] = useState(currentAccountStatus || 'active');
    const [saving, setSaving] = useState(false);

    // If selecting admin, auto-select all permissions (visually or logically)
    useEffect(() => {
        if (isAdmin) {
            // visual only, typically admin implies all access
        }
    }, [isAdmin]);

    const togglePermission = (permId: string) => {
        setPermissions(prev => {
            if (prev.includes(permId)) {
                return prev.filter(p => p !== permId);
            } else {
                return [...prev, permId];
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const roles = isAdmin ? ['admin'] : ['agent'];
            // If admin, permissions are technically redundant but we can clear them or keep them.
            // Let's clear them to avoid confusion, or keep them if we want "downgrade" preservation.
            // Usually admin overrides everything.
            await onSave({
                roles,
                permissions: isAdmin ? [] : permissions,
                accountStatus
            });
        } catch (err) {
            console.error(err);
            alert('Failed to save access settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-blue-600" />
                            Manage Access
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Editing for <span className="font-medium text-gray-900 dark:text-white">{userName || userId}</span>
                        </p>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Status Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                            Account Status
                        </h3>
                        <div className="flex gap-4">
                            {['active', 'pending', 'rejected'].map((s) => (
                                <label key={s} className={`
                  flex-1 relative flex flex-col items-center p-4 cursor-pointer rounded-lg border-2 transition-all
                  ${accountStatus === s
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}>
                                    <input
                                        type="radio"
                                        name="accountStatus"
                                        className="sr-only"
                                        checked={accountStatus === s}
                                        onChange={() => setAccountStatus(s)}
                                    />
                                    <span className={`capitalize font-medium ${accountStatus === s ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {s}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Role Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                            Role Assignment
                        </h3>
                        <label className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <input
                                type="checkbox"
                                checked={isAdmin}
                                onChange={(e) => setIsAdmin(e.target.checked)}
                                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-900 dark:text-white">Administrator</span>
                                    {isAdmin && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Full Access</span>}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Grants full access to all resources and settings. Overrides specific permissions below.
                                </p>
                            </div>
                        </label>
                    </section>

                    {/* Permissions Section */}
                    <section className={`transition-opacity duration-200 ${isAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center justify-between">
                            <span>Granular Permissions</span>
                            {isAdmin && <span className="text-xs normal-case font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Admin has all permissions</span>}
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {AVAILABLE_PERMISSIONS.map((perm) => (
                                <label
                                    key={perm.id}
                                    className={`
                    relative flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-all
                    ${permissions.includes(perm.id)
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                  `}
                                >
                                    <input
                                        type="checkbox"
                                        checked={permissions.includes(perm.id)}
                                        onChange={() => togglePermission(perm.id)}
                                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        disabled={isAdmin}
                                    />
                                    <div>
                                        <span className={`block text-sm font-medium ${permissions.includes(perm.id) ? 'text-blue-900 dark:text-blue-300' : 'text-gray-900 dark:text-gray-300'}`}>
                                            {perm.label}
                                        </span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {perm.description}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                    <button
                        onClick={onCancel}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            disabled={saving}
                            className="mr-auto px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete User
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
