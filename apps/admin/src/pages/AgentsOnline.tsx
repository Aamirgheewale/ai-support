import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, TableContainer, Table, Thead, Th, Tbody, Tr, Td } from '../components/ui';
import { Circle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me';

interface Agent {
  userId: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  createdAt?: string;
  updatedAt?: string;
  isOnline?: boolean;
  status?: 'online' | 'away'; // User-set status
}

interface AgentSession {
  sessionId: string;
  status: string;
  startTime: string;
  lastSeen: string;
  assignedAgent: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function AgentsOnline() {
  const { hasRole, token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<Record<string, AgentSession[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({});
  const [sessionError, setSessionError] = useState<Record<string, string | null>>({});
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({});

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/users/agents`, {
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to load agents');
      }

      const data = await res.json();
      const loadedAgents = data.agents || [];

      // Sort: Online first, then by name
      loadedAgents.sort((a: Agent, b: Agent) => {
        if (a.isOnline === b.isOnline) {
          return a.name.localeCompare(b.name);
        }
        return a.isOnline ? -1 : 1;
      });

      setAgents(loadedAgents);
    } catch (err: any) {
      setError(err?.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const handleViewDetails = async (agentId: string) => {
    // Toggle expansion
    if (expandedAgentId === agentId) {
      setExpandedAgentId(null);
      return;
    }

    // Reset to page 1 when viewing a different agent
    setCurrentPage(prev => ({ ...prev, [agentId]: 1 }));

    setExpandedAgentId(agentId);

    // If we already have the session history for this agent, don't fetch again
    if (sessionHistory[agentId]) {
      return;
    }

    setLoadingSessions(prev => ({ ...prev, [agentId]: true }));
    setSessionError(prev => ({ ...prev, [agentId]: null }));

    try {
      console.log(`📋 Fetching session history for agent: ${agentId}`);
      const res = await fetch(`${API_BASE}/admin/sessions/agent/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include'
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        console.error(`❌ Failed to load session history: ${res.status}`, errorData);
        throw new Error(errorData.error || `Failed to load session history (${res.status})`);
      }

      const data = await res.json();
      console.log(`✅ Received session history for agent ${agentId}:`, data);
      console.log(`   Total sessions: ${data.total || 0}, Sessions array length: ${data.sessions?.length || 0}`);
      setSessionHistory(prev => ({ ...prev, [agentId]: data.sessions || [] }));
    } catch (err: any) {
      console.error(`❌ Error loading session history for agent ${agentId}:`, err);
      setSessionError(prev => ({ ...prev, [agentId]: err?.message || 'Failed to load session history' }));
    } finally {
      setLoadingSessions(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleNextPage = (agentId: string) => {
    setCurrentPage(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || 1) + 1
    }));
  };

  const handlePrevPage = (agentId: string) => {
    setCurrentPage(prev => ({
      ...prev,
      [agentId]: Math.max(1, (prev[agentId] || 1) - 1)
    }));
  };

  const handleExportHistory = (agentId: string, agentName: string) => {
    const agentSessions = sessionHistory[agentId] || [];
    if (agentSessions.length === 0) {
      alert('No session history to export');
      return;
    }

    // Create CSV content
    const headers = ['Session ID', 'Status', 'Start Time', 'Last Seen'];
    const rows = agentSessions.map(session => [
      session.sessionId,
      session.status,
      formatDateTime(session.startTime),
      formatDateTime(session.lastSeen)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `agent-${agentName || agentId}-history-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Check if user has admin or agent role
  if (!hasRole('admin') && !hasRole('agent')) {
    return (
      <div className="p-5 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
          <p>Access denied. Admin, Super Admin, or Agent role required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-5">
        <h1 className="m-0 text-2xl font-semibold text-gray-900 dark:text-white">Agents Online</h1>
        <button
          onClick={loadAgents}
          disabled={loading}
          className={`px-4 py-2 text-white border-none rounded transition-colors ${loading
            ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
            : 'bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 cursor-pointer'
            } text-sm`}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-5 text-red-800 dark:text-red-200">
          <p className="m-0">Error: {error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-700 dark:text-gray-300">
          <p>Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="m-0 text-base text-gray-600 dark:text-gray-400">No agents found.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Agent Name</Th>
                  <Th>Role</Th>
                  <Th>Email</Th>
                  <Th>On-Boarded Date</Th>
                  <Th>Status</Th>
                  <Th>History</Th>
                </Tr>
              </Thead>
              <Tbody>
                {agents.map((agent) => (
                  <React.Fragment key={agent.userId}>
                    <Tr>
                      <Td>
                        {agent.name || 'N/A'}
                      </Td>
                      <Td>
                        <span className="inline-block px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 rounded-full text-xs font-medium">
                          Agent
                        </span>
                      </Td>
                      <Td>
                        {agent.email}
                      </Td>
                      <Td className="text-gray-600 dark:text-gray-400">
                        {formatDate(agent.createdAt)}
                      </Td>
                      <Td>
                        {/* Status badge based on user-set status and connection status */}
                        {agent.isOnline ? (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${agent.status === 'away'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            }`}>
                            <Circle className="w-2 h-2 fill-current" />
                            {agent.status === 'away' ? 'Away' : 'Online'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full text-xs font-medium">
                            <Circle className="w-2 h-2 fill-current" />
                            Offline
                          </span>
                        )}
                      </Td>
                      <Td>
                        <button
                          onClick={() => handleViewDetails(agent.userId)}
                          className={`px-3 py-1.5 border rounded text-xs font-medium transition-all ${expandedAgentId === agent.userId
                            ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500'
                            : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                            } cursor-pointer`}
                        >
                          {expandedAgentId === agent.userId ? 'Hide' : 'View'}
                        </button>
                      </Td>
                    </Tr>
                    {expandedAgentId === agent.userId && (
                      <Tr>
                        <Td colSpan={6} className="p-0 border-b border-gray-200 dark:border-gray-700">
                          <div className="bg-gray-50 dark:bg-gray-800 p-5 border-t-2 border-indigo-600 dark:border-indigo-500">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="m-0 text-lg font-semibold text-gray-900 dark:text-white">
                                Session History - {agent.name || agent.email}
                              </h3>
                              <button
                                onClick={() => handleExportHistory(agent.userId, agent.name || agent.email)}
                                disabled={!sessionHistory[agent.userId] || sessionHistory[agent.userId].length === 0}
                                className={`px-4 py-2 text-white border-none rounded transition-colors ${(!sessionHistory[agent.userId] || sessionHistory[agent.userId].length === 0)
                                  ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                                  : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 cursor-pointer'
                                  } text-sm font-medium`}
                              >
                                Export Agent History
                              </button>
                            </div>

                            {loadingSessions[agent.userId] ? (
                              <div className="text-center py-5 text-gray-600 dark:text-gray-400">
                                <p>Loading session history...</p>
                              </div>
                            ) : sessionError[agent.userId] ? (
                              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-200">
                                <p className="m-0">Error: {sessionError[agent.userId]}</p>
                              </div>
                            ) : !sessionHistory[agent.userId] || sessionHistory[agent.userId].length === 0 ? (
                              <Card className="p-5 text-center">
                                <p className="m-0 text-gray-600 dark:text-gray-400">No session history found for this agent.</p>
                              </Card>
                            ) : (() => {
                              const SESSIONS_PER_PAGE = 10;
                              const agentPage = currentPage[agent.userId] || 1;
                              const totalSessions = sessionHistory[agent.userId].length;
                              const totalPages = Math.ceil(totalSessions / SESSIONS_PER_PAGE);
                              const startIndex = (agentPage - 1) * SESSIONS_PER_PAGE;
                              const endIndex = startIndex + SESSIONS_PER_PAGE;
                              const paginatedSessions = sessionHistory[agent.userId].slice(startIndex, endIndex);

                              return (
                                <Card className="overflow-hidden">
                                  <TableContainer>
                                    <Table>
                                      <Thead>
                                        <Tr>
                                          <Th className="text-xs">Session ID</Th>
                                          <Th className="text-xs">Status</Th>
                                          <Th className="text-xs">Start Time</Th>
                                          <Th className="text-xs">Last Seen</Th>
                                        </Tr>
                                      </Thead>
                                      <Tbody>
                                        {paginatedSessions.map((session) => (
                                          <Tr key={session.sessionId}>
                                            <Td className="font-mono text-xs">
                                              {session.sessionId}
                                            </Td>
                                            <Td>
                                              <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium ${session.status === 'active'
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                                }`}>
                                                {session.status === 'active' ? 'Active' : session.status === 'closed' ? 'Closed' : session.status}
                                              </span>
                                            </Td>
                                            <Td className="text-xs text-gray-600 dark:text-gray-400">
                                              {formatDateTime(session.startTime)}
                                            </Td>
                                            <Td className="text-xs text-gray-600 dark:text-gray-400">
                                              {formatDateTime(session.lastSeen)}
                                            </Td>
                                          </Tr>
                                        ))}
                                      </Tbody>
                                    </Table>
                                  </TableContainer>

                                  {/* Pagination Controls */}
                                  <div className="flex justify-between items-center p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <div className="text-gray-600 dark:text-gray-400 text-xs">
                                      Showing {startIndex + 1}-{Math.min(endIndex, totalSessions)} of {totalSessions} session{totalSessions !== 1 ? 's' : ''}
                                    </div>

                                    {totalPages > 1 && (
                                      <div className="flex gap-2 items-center">
                                        <button
                                          onClick={() => handlePrevPage(agent.userId)}
                                          disabled={agentPage === 1}
                                          className={`px-3 py-1.5 border rounded text-xs font-medium transition-all ${agentPage === 1
                                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed'
                                            : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 cursor-pointer hover:bg-indigo-700 dark:hover:bg-indigo-600'
                                            }`}
                                        >
                                          Previous
                                        </button>

                                        <span className="text-gray-700 dark:text-gray-300 text-xs font-medium min-w-[80px] text-center">
                                          Page {agentPage} of {totalPages}
                                        </span>

                                        <button
                                          onClick={() => handleNextPage(agent.userId)}
                                          disabled={agentPage === totalPages}
                                          className={`px-3 py-1.5 border rounded text-xs font-medium transition-all ${agentPage === totalPages
                                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed'
                                            : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 cursor-pointer hover:bg-indigo-700 dark:hover:bg-indigo-600'
                                            }`}
                                        >
                                          Next
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              );
                            })()}
                          </div>
                        </Td>
                      </Tr>
                    )}
                  </React.Fragment>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {!loading && agents.length > 0 && (
        <div className="mt-4 text-right text-gray-600 dark:text-gray-400 text-sm">
          Total: {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

