import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import PaginationControls from '../components/common/PaginationControls'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me'

interface Session {
  sessionId: string
  status: string
  lastSeen: string
  startTime?: string
  assignedAgent?: string
  needsHuman?: boolean
  userMeta?: string | object
  $createdAt?: string
}

export default function SessionsList() {
  const { hasRole, hasAnyRole, token } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [fullTextSearch, setFullTextSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState<string | null>(null)
  const [bulkExporting, setBulkExporting] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  
  // Store all sessions fetched from backend
  const [allSessions, setAllSessions] = useState<Session[]>([])
  
  // Client-side pagination state (for displaying 20 per page)
  const [displayLimit, setDisplayLimit] = useState(20) // Display 20 sessions per page
  const [currentPage, setCurrentPage] = useState(0) // Current page (0-indexed)
  
  // Backend fetch state
  const [limit, setLimit] = useState(10000) // Fetch all sessions at once from backend
  const [total, setTotal] = useState(0)
  
  const navigate = useNavigate()

  useEffect(() => {
    // Reset to first page when filters change
    setCurrentPage(0)
    // Fetch all sessions when filters change
    loadSessions(0)
  }, [statusFilter, search, agentFilter, startDate, endDate, fullTextSearch])

  useEffect(() => {
    // Fetch all sessions on mount or when limit changes
    console.log(`🔄 Loading all sessions: limit=${limit}`)
    loadSessions(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  async function loadSessions(currentOffset: number = 0) { // Always fetch from offset 0 to get all sessions
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (search) params.append('search', search)
      if (agentFilter) params.append('agentId', agentFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (fullTextSearch) params.append('fullTextSearch', fullTextSearch)
      params.append('limit', limit.toString()) // Fetch all sessions (10000)
      params.append('offset', '0') // Always start from 0 to fetch all

      const res = await fetch(`${API_BASE}/admin/sessions?${params}`, {
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include' // Include cookies as fallback
      })
      const data = await res.json()
      
      // Handle both old format (sessions) and new format (items)
      let sessions = data.items || data.sessions || []
      const totalCount = data.total || sessions.length
      const hasMoreData = data.hasMore !== undefined ? data.hasMore : (currentOffset + sessions.length < totalCount)
      
      console.log(`📊 Received ${sessions.length} session(s) from backend (total: ${totalCount}, offset: ${currentOffset}, limit: ${limit})`)
      
      // Log status distribution for debugging
      const statusCounts: Record<string, number> = {}
      sessions.forEach((s: Session) => {
        const status = s.status || 'unknown'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })
      console.log('📊 Status distribution:', statusCounts)
      console.log('📊 Filter requested:', statusFilter || 'none')
      
      // IMPORTANT: Don't apply client-side filtering to paginated results!
      // The backend already handles filtering and pagination.
      // Client-side filtering should only be used as a fallback if backend filtering fails,
      // but in that case, we need to fetch ALL sessions first, not paginated ones.
      // For now, we trust the backend filtering and don't apply client-side filtering to paginated results.
      
      console.log('📊 Fetched all sessions:', sessions.length, 'Status filter:', statusFilter || 'none')
      // Store all sessions for client-side pagination
      setAllSessions(sessions)
      setTotal(totalCount)
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  function handlePageChange(newOffset: number) {
    // Convert offset to page number (offset / displayLimit)
    const newPage = Math.floor(newOffset / displayLimit)
    console.log(`🔄 Page change: page ${currentPage} → ${newPage}, offset ${newOffset}`)
    setCurrentPage(newPage)
  }
  
  // Calculate paginated sessions to display (20 per page)
  const startIndex = currentPage * displayLimit
  const endIndex = startIndex + displayLimit
  const paginatedSessions = allSessions.slice(startIndex, endIndex)
  const totalPages = Math.ceil(allSessions.length / displayLimit)
  const paginationOffset = currentPage * displayLimit

  // Helper: Download file from blob
  function downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  // Export single session
  async function exportSession(sessionId: string, format: 'json' | 'csv', e: React.MouseEvent) {
    e.stopPropagation() // Prevent row click
    setExporting(sessionId)
    
    try {
      const res = await fetch(`${API_BASE}/admin/sessions/${sessionId}/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include' // Include cookies as fallback
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }))
        alert(`Export failed: ${errorData.error || res.statusText}`)
        return
      }

      const contentDisposition = res.headers.get('content-disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `export_${sessionId}.${format}`
        : `aichat_session-${sessionId}_${new Date().toISOString().slice(0, 10)}.${format}`

      const blob = await res.blob()
      downloadFile(blob, filename)
      
      console.log(`✅ Exported session ${sessionId} as ${format}`)
    } catch (err) {
      console.error('Export error:', err)
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setExporting(null)
    }
  }

  // Bulk export
  async function handleBulkExport(format: 'json' | 'csv') {
    if (selectedSessions.size === 0) {
      alert('Please select at least one session')
      return
    }

    setBulkExporting(true)
    setShowBulkModal(false)

    try {
      const res = await fetch(`${API_BASE}/admin/sessions/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies as fallback
        body: JSON.stringify({
          sessionIds: Array.from(selectedSessions),
          format
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }))
        alert(`Bulk export failed: ${errorData.error || res.statusText}`)
        return
      }

      const contentDisposition = res.headers.get('content-disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `bulk_export.${format === 'csv' ? 'zip' : 'json'}`
        : `bulk_export_${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'zip' : 'json'}`

      const blob = await res.blob()
      downloadFile(blob, filename)
      
      console.log(`✅ Bulk exported ${selectedSessions.size} sessions as ${format}`)
      setSelectedSessions(new Set())
    } catch (err) {
      console.error('Bulk export error:', err)
      alert(`Bulk export failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setBulkExporting(false)
    }
  }

  function toggleSessionSelection(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const newSelected = new Set(selectedSessions)
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId)
    } else {
      newSelected.add(sessionId)
    }
    setSelectedSessions(newSelected)
  }

  function toggleSelectAll() {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set())
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.sessionId)))
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Customer Support - Sessions</h1>
      
      <div style={{ marginTop: '50px', marginBottom: '20px' }}>
        {/* Main Search Bar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search session ID..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            style={{ padding: '8px', flex: 1, minWidth: '200px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder="Full-text search in messages..."
            value={fullTextSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullTextSearch(e.target.value)}
            style={{ padding: '8px', flex: 1, minWidth: '200px', border: '1px solid #ddd', borderRadius: '4px' }}
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
          <button 
            onClick={() => setShowFilters(!showFilters)}
            style={{ 
              padding: '8px 16px', 
              background: showFilters ? '#6c757d' : '#667eea', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            {showFilters ? 'Hide Filters' : 'More Filters'}
          </button>
          {selectedSessions.size > 0 && hasRole('admin') && (
            <button
              onClick={() => setShowBulkModal(true)}
              disabled={bulkExporting}
              style={{ 
                padding: '8px 16px', 
                background: bulkExporting ? '#ccc' : '#28a745', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: bulkExporting ? 'not-allowed' : 'pointer' 
              }}
            >
              {bulkExporting ? 'Exporting...' : `Bulk Export (${selectedSessions.size})`}
            </button>
          )}
          <button onClick={() => loadSessions()} style={{ padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div style={{ 
            padding: '15px', 
            background: '#f8f9fa', 
            borderRadius: '4px', 
            border: '1px solid #ddd',
            marginBottom: '10px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                  Agent ID
                </label>
                <input
                  type="text"
                  placeholder="Filter by agent..."
                  value={agentFilter}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentFilter(e.target.value)}
                  style={{ padding: '6px', width: '100%', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                  style={{ padding: '6px', width: '100%', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                  style={{ padding: '6px', width: '100%', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setAgentFilter('')
                  setStartDate('')
                  setEndDate('')
                  setFullTextSearch('')
                  setSearch('')
                }}
                style={{
                  padding: '6px 12px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table style={{ width: '100%', background: 'white', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '12px', textAlign: 'left', width: '40px' }}>
                <input
                  type="checkbox"
                  checked={selectedSessions.size === sessions.length && sessions.length > 0}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Session ID</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Agent ID</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Last Seen</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Start Time</th>
              <th style={{ padding: '12px', textAlign: 'left', width: '120px' }}>Export</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSessions.map((session) => (
              <tr
                key={session.sessionId}
                onClick={() => navigate(`/sessions/${session.sessionId}`)}
                style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}
                onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => e.currentTarget.style.background = '#f8f9fa'}
                onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => e.currentTarget.style.background = 'white'}
              >
                <td style={{ padding: '12px' }} onClick={(e) => toggleSessionSelection(session.sessionId, e)}>
                  <input
                    type="checkbox"
                    checked={selectedSessions.has(session.sessionId)}
                    onChange={() => {}}
                    onClick={(e) => toggleSessionSelection(session.sessionId, e)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
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
                <td style={{ padding: '12px' }} onClick={(e) => e.stopPropagation()}>
                  {(hasRole('admin') || hasRole('agent')) ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const menu = document.getElementById(`export-menu-${session.sessionId}`)
                          if (menu) {
                            menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
                          }
                        }}
                        disabled={exporting === session.sessionId}
                        style={{
                          padding: '6px 12px',
                          background: exporting === session.sessionId ? '#ccc' : '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: exporting === session.sessionId ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {exporting === session.sessionId ? '...' : 'Export'}
                      </button>
                    <div
                      id={`export-menu-${session.sessionId}`}
                      style={{
                        display: 'none',
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        minWidth: '120px',
                        marginTop: '4px'
                      }}
                    >
                      <button
                        onClick={(e) => {
                          exportSession(session.sessionId, 'json', e)
                          const menu = document.getElementById(`export-menu-${session.sessionId}`)
                          if (menu) menu.style.display = 'none'
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          background: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        Export JSON
                      </button>
                      <button
                        onClick={(e) => {
                          exportSession(session.sessionId, 'csv', e)
                          const menu = document.getElementById(`export-menu-${session.sessionId}`)
                          if (menu) menu.style.display = 'none'
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          background: 'white',
                          border: 'none',
                          borderTop: '1px solid #eee',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>
                  ) : (
                    <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && allSessions.length === 0 && (
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
      
      {!loading && allSessions.length > 0 && (
        <>
          <div style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '4px', fontSize: '14px', color: '#666' }}>
            Showing {paginatedSessions.length} session{paginatedSessions.length !== 1 ? 's' : ''} of {allSessions.length} (page {currentPage + 1} of {totalPages})
            {statusFilter && ` with status: ${statusFilter}`}
            {selectedSessions.size > 0 && ` • ${selectedSessions.size} selected`}
          </div>
          <PaginationControls
            total={allSessions.length}
            limit={displayLimit}
            offset={paginationOffset}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {/* Bulk Export Modal */}
      {showBulkModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setShowBulkModal(false)}
        >
          <div
            style={{
              background: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Bulk Export</h2>
            <p>Export {selectedSessions.size} selected session{selectedSessions.size !== 1 ? 's' : ''} as:</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => handleBulkExport('json')}
                disabled={bulkExporting}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: bulkExporting ? '#ccc' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: bulkExporting ? 'not-allowed' : 'pointer'
                }}
              >
                JSON
              </button>
              <button
                onClick={() => handleBulkExport('csv')}
                disabled={bulkExporting}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: bulkExporting ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: bulkExporting ? 'not-allowed' : 'pointer'
                }}
              >
                CSV (ZIP)
              </button>
            </div>
            <button
              onClick={() => setShowBulkModal(false)}
              style={{
                marginTop: '15px',
                padding: '8px 16px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

