import { useState, useEffect, useRef } from 'react';
import { Terminal, X, Loader2, Save, Brain, MessageSquare, History, Sparkles, Eye } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

interface SystemPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'persona' | 'memory' | 'welcome' | 'vision';

export default function SystemPromptModal({ isOpen, onClose }: SystemPromptModalProps) {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('persona');

    // Data States
    const [prompt, setPrompt] = useState('');
    const [contextLimit, setContextLimit] = useState(10);
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [imagePrompt, setImagePrompt] = useState('');

    // UI States
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const modalRef = useRef<HTMLDivElement>(null);

    // Close on Escape & Scroll Lock
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
            // Reset states on open
            setActiveTab('persona');
            setSuccess(null);
            setError(null);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    // Fetch Data on Open
    useEffect(() => {
        if (isOpen && token) {
            fetchData();
        }
    }, [isOpen, token]);

    // Clear success/error messages when switching tabs
    useEffect(() => {
        setSuccess(null);
        setError(null);
    }, [activeTab]);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Parallel fetch
            const [promptRes, limitRes, welcomeRes, imageRes] = await Promise.all([
                fetch(`${API_BASE}/api/admin/system-prompt`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE}/api/admin/context-limit`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE}/api/admin/welcome-message`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE}/api/admin/image-prompt`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (promptRes.ok) {
                const data = await promptRes.json();
                setPrompt(data.systemPrompt || '');
            }

            if (limitRes.ok) {
                const data = await limitRes.json();
                // Default to 10 if missing
                setContextLimit(data.limit || 10);
            }

            // Fetch welcome message
            if (welcomeRes.ok) {
                const data = await welcomeRes.json();
                setWelcomeMessage(data.welcomeMessage || '');
            }

            if (imageRes.ok) {
                const data = await imageRes.json();
                setImagePrompt(data.imagePrompt || '');
            }
        } catch (err: any) {
            console.error('Error fetching settings:', err);
            setError('Failed to load settings. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(null);

        try {
            // Save logic based on active tab
            if (activeTab === 'persona') {
                const res = await fetch(`${API_BASE}/api/admin/system-prompt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ systemPrompt: prompt })
                });
                if (!res.ok) throw new Error('Failed to save system prompt');
            }
            else if (activeTab === 'memory') {
                // Validate
                const limit = Number(contextLimit);
                if (isNaN(limit) || limit < 2 || limit > 50) {
                    throw new Error('History limit must be between 2 and 50 messages');
                }

                const res = await fetch(`${API_BASE}/api/admin/context-limit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ limit })
                });
                if (!res.ok) throw new Error('Failed to save context limit');
            }
            else if (activeTab === 'welcome') {
                const res = await fetch(`${API_BASE}/api/admin/welcome-message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ welcomeMessage })
                });
                if (!res.ok) throw new Error('Failed to save welcome message');
            }
            else if (activeTab === 'vision') {
                const res = await fetch(`${API_BASE}/api/admin/image-prompt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ imagePrompt })
                });
                if (!res.ok) throw new Error('Failed to save image prompt');
            }

            setSuccess(
                activeTab === 'persona' ? 'System prompt saved!' :
                    activeTab === 'memory' ? 'Memory settings saved!' :
                        activeTab === 'welcome' ? 'Welcome message saved!' :
                            'Vision prompt saved!'
            );
            setTimeout(() => setSuccess(null), 3000);

        } catch (err: any) {
            console.error('Error saving settings:', err);
            setError(err.message || 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[10000] overflow-y-auto"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-[10000] backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="flex items-center justify-center min-h-screen p-4 relative z-[10002] pointer-events-none">
                <div
                    ref={modalRef}
                    className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden pointer-events-auto border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                <Terminal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Configuration</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Manage persona and memory settings</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-6 pt-2 gap-6 shrink-0">
                        <button
                            onClick={() => setActiveTab('persona')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'persona'
                                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                        >
                            <MessageSquare className="w-4 h-4" />
                            System Persona
                        </button>
                        <button
                            onClick={() => setActiveTab('memory')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'memory'
                                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                        >
                            <Brain className="w-4 h-4" />
                            Context Memory
                        </button>
                        <button
                            onClick={() => setActiveTab('welcome')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'welcome'
                                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                        >
                            <Sparkles className="w-4 h-4" />
                            Welcome Msg
                        </button>
                        <button
                            onClick={() => setActiveTab('vision')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'vision'
                                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                        >
                            <Eye className="w-4 h-4" />
                            Vision
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 bg-white dark:bg-gray-900 overflow-y-auto grow">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-500" />
                                <span className="text-sm">Loading settings...</span>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Alerts */}
                                {error && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                        {error}
                                    </div>
                                )}
                                {success && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg border border-green-100 dark:border-green-900/30 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                        {success}
                                    </div>
                                )}

                                {/* Persona Tab Content */}
                                {activeTab === 'persona' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="relative">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Global System Prompt
                                            </label>
                                            <textarea
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                                className="w-full h-80 p-4 rounded-lg border text-sm font-mono leading-relaxed bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none resize-none placeholder-gray-400 dark:placeholder-gray-600 transition-all focus:border-indigo-500"
                                                placeholder="You are a helpful AI assistant..."
                                                spellCheck={false}
                                            />
                                            <div className="absolute bottom-3 right-3 text-xs text-gray-400 dark:text-gray-500 pointer-events-none font-mono">
                                                {prompt.length} chars
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                                            <span className="text-indigo-500 mt-0.5">ℹ️</span>
                                            This prompt is injected into every AI conversation. use it to define the bot's identity, operational boundaries, and tone.
                                        </p>
                                    </div>
                                )}

                                {/* Memory Tab Content */}
                                {activeTab === 'memory' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-200">

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <label className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                        <History className="w-4 h-4 text-indigo-500" />
                                                        History Length (Context Window)
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        Controls how many previous messages the AI reads.
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                                                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                                        {contextLimit}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-500 font-medium tracking-wide uppercase">msgs</span>
                                                </div>
                                            </div>

                                            <input
                                                type="range"
                                                min="2"
                                                max="50"
                                                step="1"
                                                value={contextLimit}
                                                onChange={(e) => setContextLimit(Number(e.target.value))}
                                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500 focus:outline-non focus:ring-2 focus:ring-indigo-500"
                                            />

                                            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-600 font-mono">
                                                <span>2 (Min)</span>
                                                <span>25</span>
                                                <span>50 (Max)</span>
                                            </div>
                                        </div>

                                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg p-4 space-y-3">
                                            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                                <Brain className="w-4 h-4" />
                                                Memory Trade-offs
                                            </h4>
                                            <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-2 list-disc pl-4">
                                                <li>
                                                    <strong className="font-medium">Higher values (20-50):</strong> AI remembers more context but responses may be slower and cost more tokens.
                                                </li>
                                                <li>
                                                    <strong className="font-medium">Lower values (2-10):</strong> Faster and cheaper, but AI might forget earlier details in long conversations.
                                                </li>
                                                <li>
                                                    <strong className="font-medium">Recommended:</strong> 10-20 messages for balanced performance.
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {/* Welcome Message Tab Content */}
                                {activeTab === 'welcome' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="relative">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Initial Greeting
                                            </label>
                                            <textarea
                                                value={welcomeMessage}
                                                onChange={(e) => setWelcomeMessage(e.target.value)}
                                                className="w-full p-3 rounded-md border focus:ring-2 outline-none resize-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all focus:border-indigo-500"
                                                placeholder="Hi! I'm your AI Assistant. How can I help you today?"
                                                rows={4}
                                                spellCheck={false}
                                            />
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                                            <span className="text-indigo-500 mt-0.5">ℹ️</span>
                                            Sent automatically when a new chat session begins.
                                        </p>
                                    </div>
                                )}

                                {/* Vision Tab Content */}
                                {activeTab === 'vision' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="relative">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Default Vision Prompt
                                            </label>
                                            <textarea
                                                value={imagePrompt}
                                                onChange={(e) => setImagePrompt(e.target.value)}
                                                rows={6}
                                                className="w-full p-3 rounded-md border focus:ring-2 outline-none resize-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all focus:border-indigo-500"
                                                placeholder="Enter the instruction for analyzing images..."
                                                spellCheck={false}
                                            />
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                                            <span className="text-indigo-500 mt-0.5">ℹ️</span>
                                            This prompt guides the AI when analyzing images sent by users.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save {activeTab === 'persona' ? 'System Prompt' : activeTab === 'memory' ? 'Memory Settings' : 'Welcome Message'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
