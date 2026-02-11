import React, { useState, useEffect } from 'react';
import { Card, Table, Thead, Tbody, Tr, Th, Td } from '../components/ui';
import { RefreshCw, Inbox, MessageSquare, CheckCircle, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import SessionsTableSkeleton from '../components/skeletons/SessionsTableSkeleton';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

interface Session {
    sessionId: string;
    status: string;
    lastMessage: string;
    userMeta: string | any;
    assignedAgent?: string; // Backend returns assignedAgent, not assignedAgentId
    updatedAt: string;
}

export default function AgentInbox() {
    const { user, token, signout } = useAuth();
    const [activeTab, setActiveTab] = useState<'active' | 'unassigned' | 'resolved'>('active');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);
    const { theme } = useTheme();

    const fetchSessions = async () => {
        if (!user) return;
        setLoading(true);
        console.log("Auth Debug:", { user, token })
        try {
            let url = `${API_BASE}/admin/sessions?`;

            // Logic per Tab
            if (activeTab === 'active') {
                // Fetch all sessions assigned to this agent (any status)
                url += `agentId=${user.userId}`;
            } else if (activeTab === 'unassigned') {
                url += `status=active`;
                // We filter for !assignedAgent later
            } else if (activeTab === 'resolved') {
                url += `status=closed&agentId=${user.userId}`;
            }

            console.log(`🌐 Requesting: ${url}`);
            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                signout(); // Safe logout on 401
                return;
            }


            if (res.ok) {
                const data = await res.json();
                console.log(`📦 Response data:`, data);
                let fetched = data.items || data.sessions || [];
                console.log(`📊 Fetched ${fetched.length} sessions, tab: ${activeTab}`, fetched[0]);

                // Client-side filtering for Active tab - exclude closed sessions
                if (activeTab === 'active') {
                    fetched = fetched.filter((s: Session) => s.status !== 'closed');
                }

                // Client-side filtering for Unassigned
                if (activeTab === 'unassigned') {
                    fetched = fetched.filter((s: Session) => {
                        // Show sessions with no agent assigned
                        if (!s.assignedAgent) return true;

                        // Also show sessions assigned to the AI bot
                        // Check if assignedAgentId contains 'bot' or 'ai' (case-insensitive)
                        const agentId = s.assignedAgent.toLowerCase();
                        const isBotAssigned = agentId.includes('bot') || agentId.includes('ai') || agentId === 'system';

                        return isBotAssigned;
                    });
                }

                setSessions(fetched);
            } else {
                console.error('Failed to fetch sessions');
                setSessions([]);
            }
        } catch (err) {
            console.error('Error fetching sessions:', err);
            setSessions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [activeTab, user?.userId]);

    const handleRefresh = () => {
        fetchSessions();
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Inbox className="w-6 h-6 text-blue-600" />
                        Agent Inbox
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage your conversations and queue</p>
                </div>
                <button
                    onClick={handleRefresh}
                    className={`p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${loading ? 'animate-spin' : ''}`}
                    title="Refresh"
                >
                    <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
              ${activeTab === 'active'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:border-gray-300'}
            `}
                    >
                        <MessageSquare className="w-4 h-4" />
                        My Active
                    </button>
                    <button
                        onClick={() => setActiveTab('unassigned')}
                        className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
              ${activeTab === 'unassigned'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:border-gray-300'}
            `}
                    >
                        <Inbox className="w-4 h-4" />
                        Unassigned Queue
                    </button>
                    <button
                        onClick={() => setActiveTab('resolved')}
                        className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
              ${activeTab === 'resolved'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:border-gray-300'}
            `}
                    >
                        <CheckCircle className="w-4 h-4" />
                        Resolved History
                    </button>
                </nav>
            </div>

            {/* Content */}
            {loading ? (
                <SessionsTableSkeleton />
            ) : sessions.length === 0 ? (
                <Card className="min-h-[400px] flex flex-col items-center justify-center text-center p-8">
                    {activeTab === 'active' && (
                        <div className="text-gray-500 dark:text-gray-400">
                            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No active chats</h3>
                            <p className="mt-1">You don't have any active conversations at the moment.</p>
                        </div>
                    )}

                    {activeTab === 'unassigned' && (
                        <div className="text-gray-500 dark:text-gray-400">
                            <Inbox className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Queue is empty</h3>
                            <p className="mt-1">There are no unassigned queries waiting.</p>
                        </div>
                    )}

                    {activeTab === 'resolved' && (
                        <div className="text-gray-500 dark:text-gray-400">
                            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No history yet</h3>
                            <p className="mt-1">Your resolved conversation history will appear here.</p>
                        </div>
                    )}
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <Thead>
                                <Tr>
                                    <Th>Session ID</Th>
                                    <Th>Status</Th>
                                    <Th>Updated</Th>
                                    <Th className="text-right">Action</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {sessions.map((session) => (
                                    <Tr key={session.sessionId}>
                                        <Td>
                                            <div className="font-mono text-sm text-gray-900 dark:text-white">
                                                {session.sessionId}
                                            </div>
                                        </Td>
                                        <Td>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${session.status === 'active'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                                }`}>
                                                {session.status}
                                            </span>
                                        </Td>
                                        <Td>
                                            <span className="text-gray-500 dark:text-gray-400 text-sm">
                                                {new Date(session.updatedAt).toLocaleDateString()}
                                            </span>
                                        </Td>
                                        <Td className="text-right">
                                            <Link
                                                to={`/sessions/${session.sessionId}`}
                                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
                                            >
                                                Open
                                                <ExternalLink className="ml-1.5 w-3 h-3" />
                                            </Link>
                                        </Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </div>
                </Card>
            )}
        </div>
    );
}
