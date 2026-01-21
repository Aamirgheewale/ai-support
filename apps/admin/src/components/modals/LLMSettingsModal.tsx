import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Cpu, Save, Shield, Check, AlertCircle, Loader2, X, AlertTriangle, Plus, LayoutGrid, List, Pencil, Trash2 } from 'lucide-react';

interface LLMConfig {
    $id?: string;
    provider: 'google' | 'openai' | 'anthropic';
    model: string;
    apiKey: string;
    isActive?: boolean;
    healthStatus?: 'ok' | 'warning' | 'error';
    lastError?: string;
}

interface LLMSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'overview' | 'add' | 'manage';

const LLMSettingsModal = ({ isOpen, onClose }: LLMSettingsModalProps) => {
    const { user, token } = useAuth();

    // Config State
    const [configs, setConfigs] = useState<LLMConfig[]>([]);
    const [activeConfig, setActiveConfig] = useState<LLMConfig | null>(null);

    // UI State
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [loading, setLoading] = useState(true);

    // Add/Update Form State
    const [formData, setFormData] = useState<LLMConfig>({
        provider: 'google',
        model: 'gemini-1.5-flash',
        apiKey: ''
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Switching State
    const [selectedSwitchId, setSelectedSwitchId] = useState<string>('');
    const [switching, setSwitching] = useState(false);

    // Edit Key State (Mini-Dialog)
    const [editingModel, setEditingModel] = useState<LLMConfig | null>(null);
    const [newKey, setNewKey] = useState('');
    const [savingKey, setSavingKey] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

    // ----------------------------------------------------------------------
    // FETCH DATA & SORTING
    // ----------------------------------------------------------------------
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/llm-configs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                let fetchedConfigs: LLMConfig[] = data.configs || [];

                // SORTING LOGIC:
                // 1. Error
                // 2. Warning
                // 3. Active
                // 4. Others
                fetchedConfigs.sort((a, b) => {
                    const score = (c: LLMConfig) => {
                        if (c.healthStatus === 'error') return 0;
                        if (c.healthStatus === 'warning') return 1;
                        if (c.isActive) return 2;
                        return 3;
                    };
                    return score(a) - score(b);
                });

                setConfigs(fetchedConfigs);

                const currentActive = fetchedConfigs.find(c => c.isActive);
                setActiveConfig(currentActive || null);

                if (currentActive && !selectedSwitchId) {
                    setSelectedSwitchId(currentActive.$id || '');
                } else if (!selectedSwitchId && fetchedConfigs.length > 0) {
                    const healthy = fetchedConfigs.find(c => c.healthStatus !== 'error');
                    if (healthy) setSelectedSwitchId(healthy.$id || '');
                }
            }
        } catch (err) {
            console.error('Failed to fetch config', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
            setMessage(null);
            setSwitching(false);
            setSaving(false);
            setEditingModel(null);
            setActiveTab('overview');
        }
    }, [isOpen]);

    // ----------------------------------------------------------------------
    // HANDLERS
    // ----------------------------------------------------------------------

    const handleUpsert = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch(`${API_BASE}/api/admin/llm-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: 'Configuration saved and activated!' });
                setFormData(prev => ({ ...prev, apiKey: '' }));
                await fetchData();
            } else {
                throw new Error(data.message || 'Failed to save');
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingModel || !newKey) return;
        setSavingKey(true);

        try {
            const res = await fetch(`${API_BASE}/api/admin/llm-config/${editingModel.$id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ apiKey: newKey })
            });

            if (res.ok) {
                await fetchData();
                setEditingModel(null);
                setNewKey('');
                setMessage({ type: 'success', text: 'API Key updated successfully' });
            } else {
                throw new Error('Failed to update keys');
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to update key' });
        } finally {
            setSavingKey(false);
        }
    };

    const handleSwitch = async () => {
        if (!selectedSwitchId) return;
        setSwitching(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/llm-config/${selectedSwitchId}/activate`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                await fetchData();
                setMessage({ type: 'success', text: 'Switched active provider!' });
            } else {
                throw new Error('Failed to switch');
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to switch provider' });
        } finally {
            setSwitching(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this configuration?')) return;

        try {
            const res = await fetch(`${API_BASE}/api/admin/llm-config/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                await fetchData();
            } else {
                const data = await res.json();
                alert(data.message || 'Failed to delete');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    if (!user?.roles.includes('admin')) return null;

    // ----------------------------------------------------------------------
    // RENDER HELPERS
    // ----------------------------------------------------------------------

    const renderActiveConfigCard = () => {
        if (!activeConfig) return (
            <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No active configuration. Add one in the "Add / Update" tab.
            </div>
        );

        return (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded">
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active Provider</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex flex-col bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Provider</span>
                        <span className="capitalize text-sm font-medium text-purple-700 dark:text-purple-400">
                            {activeConfig.provider}
                        </span>
                    </div>
                    <div className="flex flex-col bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Model</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate" title={activeConfig.model}>
                            {activeConfig.model}
                        </span>
                    </div>
                    <div className="flex flex-col bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Active</span>
                        </div>
                    </div>
                </div>

                {/* Config Health Alert */}
                {activeConfig.healthStatus && activeConfig.healthStatus !== 'ok' && (
                    <div className={`mt-4 p-3 rounded-lg border flex items-start gap-2 ${activeConfig.healthStatus === 'error'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-yellow-50 border-yellow-200 text-yellow-900'
                        }`}>
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold">
                                {activeConfig.healthStatus === 'error' ? 'System Error' : 'Warning'}
                            </p>
                            {activeConfig.healthStatus === 'error' ? (
                                <p className="text-xs mt-1 font-medium">
                                    Action Required: Verify API key in 'Manage Fleet' or switch provider.
                                </p>
                            ) : (
                                <p className="text-xs mt-1">{activeConfig.lastError}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[10005] overflow-y-auto" onClick={onClose} role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-black/50 z-[10000]" onClick={onClose} />
            <div className="flex items-center justify-center min-h-screen p-4 relative z-[10002]">
                <div
                    ref={modalRef}
                    className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-900 sticky top-0 z-10">
                        <div className="flex items-center gap-2">
                            <Cpu className="text-purple-600 w-6 h-6" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Fleet Manager</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="px-6 border-b border-gray-100 dark:border-gray-700 flex gap-6">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview'
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <LayoutGrid className="w-4 h-4" /> Overview
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('add')}
                            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'add'
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <Plus className="w-4 h-4" /> Add / Update
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'manage'
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <List className="w-4 h-4" /> Manage Fleet
                            </div>
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="p-6 overflow-y-auto flex-1 relative">
                        {loading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            </div>
                        ) : (
                            <>
                                {/* TAB 1: OVERVIEW */}
                                {activeTab === 'overview' && (
                                    <div className="space-y-6">
                                        {renderActiveConfigCard()}

                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <h3 className="text-sm font-semibold mb-3 dark:text-white">Quick Switch</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Select a pre-configured, healthy model to activate instantly.</p>

                                            <div className="flex gap-2">
                                                <select
                                                    value={selectedSwitchId}
                                                    onChange={(e) => setSelectedSwitchId(e.target.value)}
                                                    className="flex-1 p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white"
                                                    disabled={configs.length === 0}
                                                >
                                                    {configs.length === 0 && <option value="">No configurations found</option>}
                                                    {configs.filter(c => c.healthStatus !== 'error').map(c => (
                                                        <option key={c.$id} value={c.$id}>
                                                            {c.provider.toUpperCase()} - {c.model} {c.isActive ? '(Active)' : ''}
                                                        </option>
                                                    ))}
                                                    {configs.filter(c => c.healthStatus !== 'error').length === 0 && configs.length > 0 && (
                                                        <option value="" disabled>All configured models are reporting errors.</option>
                                                    )}
                                                </select>
                                                <button
                                                    onClick={handleSwitch}
                                                    disabled={!selectedSwitchId || switching || (activeConfig && selectedSwitchId === activeConfig.$id)}
                                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Switch'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: ADD / UPDATE */}
                                {activeTab === 'add' && (
                                    <form onSubmit={handleUpsert} className="space-y-4">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-300 mb-4">
                                            <p>Enter provider and model details. If this combination exists, it will update and reset the health status. Otherwise, it adds a new fleet member.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">Provider</label>
                                                <select
                                                    value={formData.provider}
                                                    onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                                                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white"
                                                >
                                                    <option value="google">Google Gemini</option>
                                                    <option value="openai">OpenAI</option>
                                                    <option value="anthropic">Anthropic (Claude)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">Model Name</label>
                                                <input
                                                    type="text"
                                                    value={formData.model}
                                                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                                    placeholder="e.g. gpt-4o"
                                                    required
                                                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white dark:placeholder-gray-500"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1 dark:text-gray-200">API Key</label>
                                            <div className="relative">
                                                <input
                                                    type="password"
                                                    value={formData.apiKey}
                                                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                                    placeholder="Enter API key"
                                                    className="w-full p-2.5 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white dark:placeholder-gray-500"
                                                />
                                                <Shield className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">Required for new models. Leave empty when updating existing models to keep current key.</p>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save & Set Active
                                        </button>
                                    </form>
                                )}

                                {/* TAB 3: MANAGE */}
                                {activeTab === 'manage' && (
                                    <div className="space-y-4">
                                        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-800">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider / Model</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {configs.map((c) => (
                                                        <tr key={c.$id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                            <td className="px-4 py-3">
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">{c.provider}</div>
                                                                <div className="text-xs text-gray-500">{c.model}</div>
                                                            </td>
                                                            <td className="px-4 py-3 align-top">
                                                                <div className="flex flex-col items-start gap-1.5">
                                                                    {/* BADGES */}
                                                                    {c.isActive ? (
                                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20">
                                                                            ACTIVE
                                                                        </span>
                                                                    ) : c.healthStatus === 'error' ? (
                                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20">
                                                                            FAILED
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20">
                                                                            READY
                                                                        </span>
                                                                    )}

                                                                    {/* ERROR REASON */}
                                                                    {c.healthStatus === 'error' && c.lastError && (
                                                                        <span className="text-[10px] text-red-500 dark:text-red-400 font-medium leading-tight max-w-[150px] truncate" title={c.lastError}>
                                                                            {c.lastError}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={() => { setEditingModel(c); setNewKey(''); }}
                                                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                        title="Edit API Key"
                                                                    >
                                                                        <Pencil className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(c.$id!)}
                                                                        disabled={c.isActive}
                                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                        title="Delete Config"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {configs.length === 0 && (
                                                        <tr>
                                                            <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                                                                No configurations found.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* SUB-MODAL: EDIT KEY */}
                                {editingModel && (
                                    <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 flex items-center justify-center p-4 z-20 backdrop-blur-sm">
                                        <div className="w-full max-w-sm bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
                                            <h3 className="text-lg font-semibold mb-2">Update API Key</h3>
                                            <p className="text-sm text-gray-500 mb-4">
                                                Enter a new API key for <span className="font-medium text-gray-900 dark:text-white">{editingModel.provider} / {editingModel.model}</span>.
                                            </p>

                                            <form onSubmit={handleUpdateKey}>
                                                <input
                                                    type="password"
                                                    value={newKey}
                                                    onChange={(e) => setNewKey(e.target.value)}
                                                    placeholder="sk-..."
                                                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm mb-4"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingModel(null)}
                                                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={!newKey || savingKey}
                                                        className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
                                                    >
                                                        {savingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save Changes'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                )}

                                {message && (
                                    <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success'
                                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                        {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        {message.text}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LLMSettingsModal;
