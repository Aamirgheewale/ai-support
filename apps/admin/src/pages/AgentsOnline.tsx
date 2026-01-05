import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

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
      setAgents(data.agents || []);
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
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ 
          background: '#fee2e2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px', 
          padding: '16px',
          color: '#991b1b'
        }}>
          <p>Access denied. Admin, Super Admin, or Agent role required.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Agents Online</h1>
        <button 
          onClick={loadAgents} 
          disabled={loading}
          style={{ 
            padding: '8px 16px', 
            background: loading ? '#ccc' : '#667eea', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ 
          background: '#fee2e2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px', 
          padding: '12px',
          marginBottom: '20px',
          color: '#991b1b'
        }}>
          <p style={{ margin: 0 }}>Error: {error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div style={{ 
          background: '#f8f9fa', 
          border: '1px solid #dee2e6', 
          borderRadius: '8px', 
          padding: '40px',
          textAlign: 'center',
          color: '#6c757d'
        }}>
          <p style={{ margin: 0, fontSize: '16px' }}>No agents found.</p>
        </div>
      ) : (
        <div style={{ 
          background: 'white', 
          border: '1px solid #dee2e6', 
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#495057'
                }}>
                  Agent Name
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#495057'
                }}>
                  Role
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#495057'
                }}>
                  Email
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#495057'
                }}>
                  On-Boarded Date
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#495057'
                }}>
                  Status
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#495057'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, index) => (
                <React.Fragment key={agent.userId}>
                  <tr 
                    style={{ 
                      borderBottom: expandedAgentId === agent.userId ? 'none' : (index < agents.length - 1 ? '1px solid #dee2e6' : 'none'),
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#212529' }}>
                      {agent.name || 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: '#d1ecf1',
                        color: '#0c5460',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        Agent
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#212529' }}>
                      {agent.email}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6c757d' }}>
                      {formatDate(agent.createdAt)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {/* Status badge based on user-set status and connection status */}
                      {agent.isOnline ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          background: agent.status === 'away' ? '#fef3c7' : '#d1fae5',
                          color: agent.status === 'away' ? '#92400e' : '#065f46',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {agent.status === 'away' ? '🟡 Away' : '🟢 Online'}
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          background: '#fee2e2',
                          color: '#991b1b',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          ⚫ Offline
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => handleViewDetails(agent.userId)}
                        style={{
                          padding: '6px 12px',
                          background: expandedAgentId === agent.userId ? '#667eea' : '#f8f9fa',
                          color: expandedAgentId === agent.userId ? 'white' : '#495057',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          transition: 'all 0.2s'
                        }}
                      >
                        {expandedAgentId === agent.userId ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {expandedAgentId === agent.userId && (
                  <tr>
                    <td colSpan={6} style={{ padding: '0', borderBottom: '1px solid #dee2e6' }}>
                      <div style={{
                        background: '#f8f9fa',
                        padding: '20px',
                        borderTop: '2px solid #667eea'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px'
                        }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#212529' }}>
                            Session History - {agent.name || agent.email}
                          </h3>
                          <button
                            onClick={() => handleExportHistory(agent.userId, agent.name || agent.email)}
                            disabled={!sessionHistory[agent.userId] || sessionHistory[agent.userId].length === 0}
                            style={{
                              padding: '8px 16px',
                              background: (!sessionHistory[agent.userId] || sessionHistory[agent.userId].length === 0) ? '#ccc' : '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: (!sessionHistory[agent.userId] || sessionHistory[agent.userId].length === 0) ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}
                          >
                            Export Agent History
                          </button>
                        </div>

                        {loadingSessions[agent.userId] ? (
                          <div style={{ textAlign: 'center', padding: '20px' }}>
                            <p style={{ color: '#6c757d' }}>Loading session history...</p>
                          </div>
                        ) : sessionError[agent.userId] ? (
                          <div style={{
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '12px',
                            color: '#991b1b'
                          }}>
                            <p style={{ margin: 0 }}>Error: {sessionError[agent.userId]}</p>
                          </div>
                        ) : !sessionHistory[agent.userId] || sessionHistory[agent.userId].length === 0 ? (
                          <div style={{
                            background: '#f8f9fa',
                            border: '1px solid #dee2e6',
                            borderRadius: '8px',
                            padding: '20px',
                            textAlign: 'center',
                            color: '#6c757d'
                          }}>
                            <p style={{ margin: 0 }}>No session history found for this agent.</p>
                          </div>
                        ) : (
                          <div style={{
                            background: 'white',
                            border: '1px solid #dee2e6',
                            borderRadius: '8px',
                            overflow: 'hidden'
                          }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                  <th style={{
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    color: '#495057'
                                  }}>
                                    Session ID
                                  </th>
                                  <th style={{
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    color: '#495057'
                                  }}>
                                    Status
                                  </th>
                                  <th style={{
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    color: '#495057'
                                  }}>
                                    Start Time
                                  </th>
                                  <th style={{
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    color: '#495057'
                                  }}>
                                    Last Seen
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sessionHistory[agent.userId].map((session, index) => (
                                  <tr
                                    key={session.sessionId}
                                    style={{
                                      borderBottom: index < sessionHistory[agent.userId].length - 1 ? '1px solid #dee2e6' : 'none',
                                      transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'white';
                                    }}
                                  >
                                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#212529', fontFamily: 'monospace' }}>
                                      {session.sessionId}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{
                                        display: 'inline-block',
                                        padding: '4px 10px',
                                        background: session.status === 'active' ? '#d1fae5' : '#fee2e2',
                                        color: session.status === 'active' ? '#065f46' : '#991b1b',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '500'
                                      }}>
                                        {session.status === 'active' ? 'Active' : session.status === 'closed' ? 'Closed' : session.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6c757d' }}>
                                      {formatDateTime(session.startTime)}
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6c757d' }}>
                                      {formatDateTime(session.lastSeen)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{
                              marginTop: '12px',
                              textAlign: 'right',
                              color: '#6c757d',
                              fontSize: '13px',
                              padding: '0 12px 12px'
                            }}>
                              Total: {sessionHistory[agent.userId].length} session{sessionHistory[agent.userId].length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && agents.length > 0 && (
        <div style={{ 
          marginTop: '16px', 
          textAlign: 'right', 
          color: '#6c757d', 
          fontSize: '14px' 
        }}>
          Total: {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

