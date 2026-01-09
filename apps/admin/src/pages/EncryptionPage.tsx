/**
 * Encryption Management Page
 * 
 * UI for managing encryption settings, running migrations, and viewing encryption status.
 * Restricted to admin role only.
 * 
 * Placement: Add link in Navigation component under Admin/Settings
 * See screenshot: /mnt/data/9543afb1-4904-4dca-89b9-ba4235054337.png for placement reference
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, TableContainer, Table, Thead, Th, Tbody, Tr, Td } from '../components/ui';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me';

interface EncryptionStatus {
  encryptionEnabled: boolean;
  masterKeyPresent: boolean;
  redactPII: boolean;
  collections: Record<string, {
    encrypted: number;
    plaintext: number;
    total: number;
    error?: string;
  }>;
}

interface AuditLog {
  action: string;
  adminId: string;
  stats: string | object;
  ts: string;
}

export default function EncryptionPage() {
  const { hasRole, user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<EncryptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [newMasterKey, setNewMasterKey] = useState('');
  const [showRotationModal, setShowRotationModal] = useState(false);

  useEffect(() => {
    // Wait for auth to load, then check role and load data
    if (authLoading) {
      return;
    }
    
    if (hasRole('admin')) {
      loadStatus();
      loadAuditLogs();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.roles]);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/encryption/status`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to load encryption status');
      }
      
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/encryption/audit?limit=20`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleDryRunMigration = async () => {
    addLog('Starting dry-run migration...');
    addLog('⚠️  This is a preview only - no data will be modified');
    addLog('Run the migration script manually:');
    addLog('  node apps/api/migrations/migrate_encrypt_existing_data.js --dry-run');
    addLog('See RUN_CHECKLIST.md for full instructions');
  };

  const handleStartMigration = async () => {
    if (!confirm('⚠️  This will encrypt all existing plaintext data. Continue?')) {
      return;
    }
    
    addLog('Starting full migration...');
    addLog('⚠️  Run the migration script manually:');
    addLog('  MASTER_KEY_BASE64="<key>" node apps/api/migrations/migrate_encrypt_existing_data.js');
    addLog('See RUN_CHECKLIST.md for full instructions');
  };

  const handleKeyRotation = async () => {
    if (!newMasterKey.trim()) {
      alert('Please enter the new master key (base64)');
      return;
    }
    
    if (!confirm('⚠️  Key rotation should be done via migration script. Continue with API request?')) {
      return;
    }
    
    addLog('Requesting key rotation...');
    try {
      const res = await fetch(`${API_BASE}/admin/encryption/reencrypt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newMasterKeyBase64: newMasterKey })
      });
      
      const data = await res.json();
      if (res.ok || res.status === 202) {
        addLog('✅ Rotation request received');
        addLog('Follow instructions in response to complete rotation');
        setLogs(prev => [...prev, ...(data.instructions || [])]);
      } else {
        addLog(`❌ Error: ${data.error || 'Failed'}`);
      }
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
    }
    
    setShowRotationModal(false);
    setNewMasterKey('');
  };

  const handleCleanupPlaintext = async () => {
    if (!confirm('⚠️  This will remove plaintext backup fields. Continue?')) {
      return;
    }
    
    addLog('Requesting cleanup...');
    try {
      const res = await fetch(`${API_BASE}/admin/encryption/cleanup-plaintext`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirm: 'yes' })
      });
      
      const data = await res.json();
      if (res.ok) {
        addLog('✅ Cleanup request received');
      } else {
        addLog(`⚠️  ${data.error || 'Use migration script for cleanup'}`);
        if (data.instructions) {
          setLogs(prev => [...prev, ...data.instructions]);
        }
      }
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
    }
  };

  // Check if user has admin role (after all hooks)
  if (!hasRole('admin')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            Access denied. Super admin role required to manage encryption.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-gray-700 dark:text-gray-300">Loading encryption status...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Encryption Management</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage encryption settings, run migrations, and view encryption status
        </p>
      </div>

      {/* Status Card */}
      {status && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Encryption Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`p-4 rounded ${status.encryptionEnabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Encryption</div>
              <div className={`text-2xl font-bold ${status.encryptionEnabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {status.encryptionEnabled ? '✅ Enabled' : '❌ Disabled'}
              </div>
            </div>
            <div className={`p-4 rounded ${status.masterKeyPresent ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Master Key</div>
              <div className={`text-2xl font-bold ${status.masterKeyPresent ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                {status.masterKeyPresent ? '✅ Present' : '⚠️  Missing'}
              </div>
            </div>
            <div className="p-4 rounded bg-blue-50 dark:bg-blue-900/20">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">PII Redaction</div>
              <div className={`text-2xl font-bold ${status.redactPII ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {status.redactPII ? '✅ Enabled' : '❌ Disabled'}
              </div>
            </div>
          </div>

          {/* Collection Status */}
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Collection Status</h3>
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Collection</Th>
                  <Th>Encrypted</Th>
                  <Th>Plaintext</Th>
                  <Th>Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {Object.entries(status.collections).map(([name, stats]) => (
                  <Tr key={name}>
                    <Td className="font-medium">{name}</Td>
                    <Td className="text-green-600 dark:text-green-400">{stats.encrypted || 0}</Td>
                    <Td className="text-orange-600 dark:text-orange-400">{stats.plaintext || 0}</Td>
                    <Td className="text-gray-600 dark:text-gray-400">{stats.total || 0}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Actions */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleDryRunMigration}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Run Dry-Run Migration
          </button>
          <button
            onClick={handleStartMigration}
            className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
          >
            Start Full Migration
          </button>
          <button
            onClick={() => setShowRotationModal(true)}
            className="px-4 py-2 bg-yellow-600 dark:bg-yellow-500 text-white rounded hover:bg-yellow-700 dark:hover:bg-yellow-600 transition-colors"
          >
            Rotate Master Key
          </button>
          <button
            onClick={handleCleanupPlaintext}
            className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
          >
            Cleanup Plaintext Backups
          </button>
        </div>
      </Card>

      {/* Logs Console */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Operation Logs</h2>
        <div className="bg-gray-900 dark:bg-gray-950 text-green-400 dark:text-green-300 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400">No logs yet. Run an action to see output.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))
          )}
        </div>
        <button
          onClick={() => setLogs([])}
          className="mt-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Clear Logs
        </button>
      </Card>

      {/* Audit Logs */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Audit Log</h2>
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Time</Th>
                <Th>Action</Th>
                <Th>Admin</Th>
              </Tr>
            </Thead>
            <Tbody>
              {auditLogs.length === 0 ? (
                <Tr>
                  <Td colSpan={3} className="text-center text-gray-500 dark:text-gray-400">
                    No audit logs yet
                  </Td>
                </Tr>
              ) : (
                auditLogs.map((log, i) => (
                  <Tr key={i}>
                    <Td className="text-gray-600 dark:text-gray-400">
                      {new Date(log.ts).toLocaleString()}
                    </Td>
                    <Td className="font-medium">{log.action}</Td>
                    <Td className="text-gray-600 dark:text-gray-400">{log.adminId}</Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </Card>

      {/* Rotation Modal */}
      {showRotationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Rotate Master Key</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              ⚠️  Key rotation should be done via migration script for safety.
              Enter new key only if you understand the risks.
            </p>
            <input
              type="text"
              value={newMasterKey}
              onChange={(e) => setNewMasterKey(e.target.value)}
              placeholder="New MASTER_KEY_BASE64 (32 bytes base64)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleKeyRotation}
                className="flex-1 px-4 py-2 bg-yellow-600 dark:bg-yellow-500 text-white rounded hover:bg-yellow-700 dark:hover:bg-yellow-600 transition-colors"
              >
                Request Rotation
              </button>
              <button
                onClick={() => {
                  setShowRotationModal(false);
                  setNewMasterKey('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

