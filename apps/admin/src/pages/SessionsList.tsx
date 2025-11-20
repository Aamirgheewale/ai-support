import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = 'http://localhost:4000'
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me'

interface Session {
  sessionId: string
  status: string
  lastSeen: string
  startTime?: string
  assignedAgent?: string
  needsHuman?: boolean
  userMeta?: string | object
}

export default function SessionsList() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadSessions()
  }, [statusFilter, search])

  async function loadSessions() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (search) params.append('search', search)
      params.append('limit', '100')

      const res = await fetch(`${API_BASE}/admin/sessions?${params}`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`
        }
      })
      const data = await res.json()
      let sessions = data.sessions || []
      
      console.log(`📊 Received ${sessions.length} session(s) from backend`)
      
      // Log status distribution for debugging
      const statusCounts: Record<string, number> = {}
      sessions.forEach((s: Session) => {
        const status = s.status || 'unknown'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })
      console.log('📊 Status distribution:', statusCounts)
      console.log('📊 Filter requested:', statusFilter || 'none')
      
      // Client-side filtering as fallback (in case backend filter doesn't work)
      if (statusFilter && statusFilter.trim() !== '') {
        const beforeFilter = sessions.length
        sessions = sessions.filter((s: Session) => {
          const matches = s.status === statusFilter
          // Special handling for agent_assigned - also check if agent is assigned
          if (!matches && statusFilter === 'agent_assigned' && s.assignedAgent) {
            return true
          }
          return matches
        })
        console.log(`📊 Client-side filter: ${beforeFilter} → ${sessions.length} sessions with status="${statusFilter}"`)
        
        // Log what statuses we actually have
        const actualStatuses = [...new Set(sessions.map((s: Session) => s.status || 'unknown'))]
        console.log('📊 Actual statuses in filtered results:', actualStatuses)
      }
      
      console.log('📊 Displaying sessions:', sessions.length, 'Status filter:', statusFilter || 'none')
      setSessions(sessions)
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>AI Support Admin - Sessions</h1>
      
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search session ID..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          style={{ padding: '8px', flex: 1, border: '1px solid #ddd', borderRadius: '4px' }}
        />
        <select
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="agent_assigned">Agent Assigned</option>
          <option value="closed">Closed</option>
        </select>
        <button onClick={loadSessions} style={{ padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table style={{ width: '100%', background: 'white', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Session ID</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Agent ID</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Last Seen</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Start Time</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr
                key={session.sessionId}
                onClick={() => navigate(`/sessions/${session.sessionId}`)}
                style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}
                onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => e.currentTarget.style.background = '#f8f9fa'}
                onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => e.currentTarget.style.background = 'white'}
              >
                <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px' }}>{session.sessionId}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: session.status === 'active' ? '#d4edda' : session.status === 'agent_assigned' ? '#d1ecf1' : session.status === 'closed' ? '#f8d7da' : '#e2e3e5',
                    color: session.status === 'active' ? '#155724' : session.status === 'agent_assigned' ? '#0c5460' : session.status === 'closed' ? '#721c24' : '#383d41'
                  }}>
                    {session.status || 'unknown'}
                  </span>
                </td>
                <td style={{ padding: '12px', fontWeight: session.assignedAgent ? '600' : 'normal' }}>
                  {session.assignedAgent ? (
                    <span style={{ color: '#28a745' }}>{session.assignedAgent}</span>
                  ) : (
                    <span style={{ color: '#999' }}>-</span>
                  )}
                </td>
                <td style={{ padding: '12px', fontSize: '13px' }}>
                  {session.lastSeen ? new Date(session.lastSeen).toLocaleString() : '-'}
                </td>
                <td style={{ padding: '12px', fontSize: '13px' }}>
                  {session.startTime ? new Date(session.startTime).toLocaleString() : session.$createdAt ? new Date(session.$createdAt).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && sessions.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          {statusFilter ? (
            <>
              <p>No sessions found with status: <strong>{statusFilter}</strong></p>
              <button 
                onClick={() => setStatusFilter('')} 
                style={{ marginTop: '10px', padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Show All Sessions
              </button>
            </>
          ) : (
            <p>No sessions found</p>
          )}
        </div>
      )}
      
      {!loading && sessions.length > 0 && (
        <div style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '4px', fontSize: '14px', color: '#666' }}>
          Showing {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          {statusFilter && ` with status: ${statusFilter}`}
        </div>
      )}
    </div>
  )
}

