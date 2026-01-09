import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import PaginationControls from '../components/common/PaginationControls'
import { Card, TableContainer, Table, Thead, Th, Tbody, Tr, Td } from '../components/ui'

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
    <div className="p-5 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Customer Support - Sessions</h1>
      
      <div className="mt-12 mb-5">
        {/* Main Search Bar */}
        <div className="flex gap-2.5 mb-2.5 flex-wrap items-center">
          <input
            type="text"
            placeholder="Search session ID..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-2 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <input
            type="text"
            placeholder="Full-text search in messages..."
            value={fullTextSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullTextSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-2 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <select
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
            className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="agent_assigned">Agent Assigned</option>
            <option value="closed">Closed</option>
          </select>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 text-white rounded cursor-pointer transition-colors ${
              showFilters 
                ? 'bg-gray-600 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-700' 
                : 'bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600'
            }`}
          >
            {showFilters ? 'Hide Filters' : 'More Filters'}
          </button>
          {selectedSessions.size > 0 && hasRole('admin') && (
            <button
              onClick={() => setShowBulkModal(true)}
              disabled={bulkExporting}
              className={`px-4 py-2 text-white rounded transition-colors ${
                bulkExporting
                  ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                  : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 cursor-pointer'
              }`}
            >
              {bulkExporting ? 'Exporting...' : `Bulk Export (${selectedSessions.size})`}
            </button>
          )}
          <button 
            onClick={() => loadSessions()} 
            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded cursor-pointer transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <Card className="p-4 mb-2.5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
              <div>
                <label className="block mb-1 text-[13px] font-medium text-gray-700 dark:text-gray-300">
                  Agent ID
                </label>
                <input
                  type="text"
                  placeholder="Filter by agent..."
                  value={agentFilter}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentFilter(e.target.value)}
                  className="w-full px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-[13px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block mb-1 text-[13px] font-medium text-gray-700 dark:text-gray-300">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                  className="w-full px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-[13px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block mb-1 text-[13px] font-medium text-gray-700 dark:text-gray-300">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                  className="w-full px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-[13px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="mt-2.5 flex gap-2.5">
              <button
                onClick={() => {
                  setAgentFilter('')
                  setStartDate('')
                  setEndDate('')
                  setFullTextSearch('')
                  setSearch('')
                }}
                className="px-3 py-1.5 bg-gray-600 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-700 text-white rounded cursor-pointer text-xs transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </Card>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-700 dark:text-gray-300">Loading...</div>
      ) : (
        <Card className="overflow-hidden">
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedSessions.size === sessions.length && sessions.length > 0}
                      onChange={toggleSelectAll}
                      className="cursor-pointer h-4 w-4 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                    />
                  </Th>
                  <Th>Session ID</Th>
                  <Th>Status</Th>
                  <Th>Agent ID</Th>
                  <Th>Last Seen</Th>
                  <Th>Start Time</Th>
                  <Th className="w-32">Export</Th>
                </Tr>
              </Thead>
              <Tbody>
                {paginatedSessions.map((session) => (
                  <Tr
                    key={session.sessionId}
                    onClick={() => navigate(`/sessions/${session.sessionId}`)}
                    className="cursor-pointer"
                  >
                    <Td onClick={(e) => toggleSessionSelection(session.sessionId, e)}>
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.sessionId)}
                        onChange={() => {}}
                        onClick={(e) => toggleSessionSelection(session.sessionId, e)}
                        className="cursor-pointer h-4 w-4 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                      />
                    </Td>
                    <Td className="font-mono text-xs">{session.sessionId}</Td>
                    <Td>
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        session.status === 'active' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                          : session.status === 'agent_assigned'
                          ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300'
                          : session.status === 'closed'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                        {session.status || 'unknown'}
                      </span>
                    </Td>
                    <Td className={session.assignedAgent ? 'font-semibold' : ''}>
                      {session.assignedAgent ? (
                        <span className="text-green-600 dark:text-green-400">{session.assignedAgent}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </Td>
                    <Td className="text-xs">
                      {session.lastSeen ? new Date(session.lastSeen).toLocaleString() : '-'}
                    </Td>
                    <Td className="text-xs">
                      {session.startTime ? new Date(session.startTime).toLocaleString() : session.$createdAt ? new Date(session.$createdAt).toLocaleString() : '-'}
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      {(hasRole('admin') || hasRole('agent')) ? (
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const menu = document.getElementById(`export-menu-${session.sessionId}`)
                              if (menu) {
                                menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
                              }
                            }}
                            disabled={exporting === session.sessionId}
                            className={`px-3 py-1.5 text-xs rounded ${
                              exporting === session.sessionId
                                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                                : 'bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 cursor-pointer'
                            } text-white`}
                          >
                            {exporting === session.sessionId ? '...' : 'Export'}
                          </button>
                          <div
                            id={`export-menu-${session.sessionId}`}
                            className="hidden absolute top-full left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-[1000] min-w-[120px] mt-1"
                          >
                            <button
                              onClick={(e) => {
                                exportSession(session.sessionId, 'json', e)
                                const menu = document.getElementById(`export-menu-${session.sessionId}`)
                                if (menu) menu.style.display = 'none'
                              }}
                              className="block w-full px-3 py-2 text-left text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border-none cursor-pointer transition-colors"
                            >
                              Export JSON
                            </button>
                            <button
                              onClick={(e) => {
                                exportSession(session.sessionId, 'csv', e)
                                const menu = document.getElementById(`export-menu-${session.sessionId}`)
                                if (menu) menu.style.display = 'none'
                              }}
                              className="block w-full px-3 py-2 text-left text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 border-l-0 border-r-0 border-b-0 cursor-pointer transition-colors"
                            >
                              Export CSV
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {!loading && allSessions.length === 0 && (
        <Card className="p-10 text-center">
          {statusFilter ? (
            <>
              <p className="text-gray-600 dark:text-gray-400">
                No sessions found with status: <strong className="text-gray-900 dark:text-white">{statusFilter}</strong>
              </p>
              <button 
                onClick={() => setStatusFilter('')} 
                className="mt-2.5 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded cursor-pointer transition-colors"
              >
                Show All Sessions
              </button>
            </>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">No sessions found</p>
          )}
        </Card>
      )}
      
      {!loading && allSessions.length > 0 && (
        <>
          <div className="mt-2.5 p-2.5 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-400">
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

