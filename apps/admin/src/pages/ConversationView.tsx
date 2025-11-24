import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'

const API_BASE = 'http://localhost:4000'
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me'

interface Message {
  sender: string
  text: string
  timestamp: string
  agentId?: string
}

export default function ConversationView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { hasAnyRole } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [agentId, setAgentId] = useState('')
  const [messageText, setMessageText] = useState('')
  const [socket, setSocket] = useState<any>(null)
  const [sessionStatus, setSessionStatus] = useState<string>('')
  const [assignedAgentId, setAssignedAgentId] = useState<string>('')
  const [exporting, setExporting] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  
  // Message pagination state
  const [messageLimit, setMessageLimit] = useState(100) // Default: load all
  const [messageOffset, setMessageOffset] = useState(0)
  const [messageTotal, setMessageTotal] = useState(0)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (showExportMenu && !target.closest('[data-export-menu]')) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportMenu])

  // Load session info and messages when sessionId changes
  useEffect(() => {
    if (!sessionId) return
    
    // Load both session info and messages
    loadSessionInfo()
    loadMessages()
    
    // Connect to socket for real-time updates
    const sock = io('http://localhost:4000')
    
    sock.on('connect', () => {
      console.log('✅ Socket connected')
      // CRITICAL: Join session room to receive real-time updates (user messages, agent messages, bot messages)
      if (sessionId) {
        sock.emit('join_session', { sessionId })
        console.log(`📱 Admin socket joined session room: ${sessionId}`)
      }
      // Auto-connect as agent if session has assigned agent
      if (assignedAgentId) {
        setAgentId(assignedAgentId)
        sock.emit('agent_connect', { agentId: assignedAgentId })
        console.log(`👤 Auto-connected as agent: ${assignedAgentId}`)
      } else if (agentId) {
        sock.emit('agent_connect', { agentId })
        console.log(`👤 Connected as agent: ${agentId}`)
      }
    })
    
    // Listen for user messages forwarded to agent
    sock.on('user_message_for_agent', (data: any) => {
      console.log('📨 Received user_message_for_agent:', data)
      if (data.sessionId === sessionId) {
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          const exists = prev.some(m => m.text === data.text && m.sender === 'user' && Math.abs(new Date(m.timestamp).getTime() - (data.ts || Date.now())) < 1000)
          if (exists) {
            console.log('   ⚠️  Duplicate message, skipping')
            return prev
          }
          console.log('   ✅ Adding user message to UI')
          return [...prev, { 
            sender: 'user', 
            text: data.text, 
            timestamp: new Date(data.ts || Date.now()).toISOString() 
          }]
        })
      } else {
        console.log(`   ⚠️  Message for different session: ${data.sessionId} (current: ${sessionId})`)
      }
    })
    
    // Listen for agent messages (from any agent, not just current user)
    sock.on('agent_message', (data: any) => {
      console.log('📨 Received agent_message:', data)
      if (data.sessionId === sessionId || !data.sessionId) {
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          const exists = prev.some(m => 
            m.sender === 'agent' && 
            m.text === data.text && 
            Math.abs(new Date(m.timestamp).getTime() - (data.ts || Date.now())) < 2000
          )
          if (exists) {
            console.log('   ⚠️  Duplicate agent message, skipping')
            return prev
          }
          console.log('   ✅ Adding agent message to UI')
          return [...prev, { 
            sender: 'agent', 
            text: data.text, 
            timestamp: new Date(data.ts || Date.now()).toISOString(), 
            agentId: data.agentId 
          }]
        })
      } else {
        console.log(`   ⚠️  Agent message for different session: ${data.sessionId} (current: ${sessionId})`)
      }
    })
    
    // Listen for user messages (from widget) for real-time updates
    sock.on('user_message', (data: any) => {
      console.log('📨 Received user_message (real-time):', data)
      if (data.sessionId === sessionId || !data.sessionId) {
        setMessages(prev => {
          const exists = prev.some(m => 
            m.sender === 'user' && 
            m.text === data.text && 
            Math.abs(new Date(m.timestamp).getTime() - (data.ts || Date.now())) < 2000
          )
          if (exists) {
            console.log('   ⚠️  Duplicate user message, skipping')
            return prev
          }
          console.log('   ✅ Adding user message to UI (real-time)')
          return [...prev, { 
            sender: 'user', 
            text: data.text, 
            timestamp: new Date(data.ts || Date.now()).toISOString() 
          }]
        })
      }
    })
    
    // Listen for bot messages for real-time updates
    sock.on('bot_message', (data: any) => {
      console.log('📨 Received bot_message (real-time):', data)
      setMessages(prev => {
        const exists = prev.some(m => 
          m.sender === 'bot' && 
          m.text === data.text && 
          Math.abs(new Date(m.timestamp).getTime() - Date.now()) < 2000
        )
        if (exists) {
          console.log('   ⚠️  Duplicate bot message, skipping')
          return prev
        }
        console.log('   ✅ Adding bot message to UI (real-time)')
        return [...prev, { 
          sender: 'bot', 
          text: data.text, 
          timestamp: new Date().toISOString(),
          confidence: data.confidence
        }]
      })
    })
    
    // Listen for assignment notifications
    sock.on('assignment', (data: any) => {
      console.log('📨 Assignment notification:', data)
    })
    
    setSocket(sock)
    
    return () => {
      sock.disconnect()
    }
  }, [sessionId, assignedAgentId])
  
  // Separate effect to reconnect when agentId changes
  useEffect(() => {
    if (socket && socket.connected && agentId) {
      socket.emit('agent_connect', { agentId })
      console.log(`👤 Reconnected as agent: ${agentId}`)
    }
  }, [agentId, socket])
  
  // Load session info to get assigned agent
  async function loadSessionInfo() {
    if (!sessionId) return
    
    try {
      const res = await fetch(`${API_BASE}/admin/sessions`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`
        }
      })
      const data = await res.json()
      const session = (data.sessions || []).find((s: any) => s.sessionId === sessionId)
      
      if (session) {
        setSessionStatus(session.status || '')
        
        // Extract assignedAgent from session
        let agent = session.assignedAgent || null
        if (!agent && session.userMeta) {
          try {
            const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta
            if (userMeta?.assignedAgent) {
              agent = userMeta.assignedAgent
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        if (agent) {
          setAssignedAgentId(agent)
          setAgentId(agent) // Auto-fill agent ID field
          console.log(`✅ Found assigned agent: ${agent}`)
        }
      }
    } catch (err) {
      console.error('Failed to load session info:', err)
    }
  }

  async function loadMessages(loadOlder: boolean = false) {
    if (!sessionId) return
    
    if (loadOlder) {
      setLoadingOlder(true)
    } else {
      setLoading(true)
      setMessageOffset(0) // Reset to start when loading fresh
    }
    
    try {
      const currentOffset = loadOlder ? messageOffset + messageLimit : 0
      console.log(`📨 Loading messages for session: ${sessionId}, offset: ${currentOffset}, limit: ${messageLimit}`)
      
      const params = new URLSearchParams()
      if (messageLimit < 10000) {
        params.append('limit', messageLimit.toString())
        params.append('offset', currentOffset.toString())
        params.append('order', 'asc') // Oldest first for pagination
      }
      
      const res = await fetch(`${API_BASE}/admin/sessions/${sessionId}/messages?${params}`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`
        }
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(`Failed to load messages: ${res.status} ${errorData.error || res.statusText}`)
      }
      
      const data = await res.json()
      const messages = data.items || data.messages || []
      const total = data.total || messages.length
      
      console.log(`📨 Received ${messages.length} message(s) from backend (total: ${total}, offset: ${currentOffset})`)
      
      // Transform Appwrite messages to UI format - includes user, bot, and agent messages
      const transformedMessages = messages.map((msg: any) => {
        // Parse metadata if it's a string
        let metadata = {}
        if (msg.metadata) {
          try {
            metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        return {
          sender: msg.sender || 'unknown',
          text: msg.text || '',
          timestamp: msg.createdAt || msg.timestamp || msg.$createdAt || new Date().toISOString(),
          agentId: metadata.agentId || undefined
        }
      })
      
      console.log(`📊 Transformed ${transformedMessages.length} message(s)`)
      console.log(`📊 Message senders:`, [...new Set(transformedMessages.map((m: Message) => m.sender))])
      
      if (loadOlder) {
        // Prepend older messages to existing messages
        setMessages(prev => {
          // Merge and sort by timestamp to avoid duplicates
          const merged = [...transformedMessages, ...prev]
          merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          // Remove duplicates based on text and timestamp
          const unique = merged.filter((msg, idx, arr) => {
            return idx === 0 || !arr.slice(0, idx).some(m => 
              m.text === msg.text && 
              m.sender === msg.sender && 
              Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000
            )
          })
          return unique
        })
        setMessageOffset(currentOffset)
      } else {
        // Replace all messages (initial load)
        setMessages(transformedMessages)
        setMessageOffset(0)
      }
      
      setMessageTotal(total)
    } catch (err) {
      console.error('❌ Failed to load messages:', err)
      if (!loadOlder) {
        alert('Failed to load messages: ' + (err instanceof Error ? err.message : 'Unknown error'))
        setMessages([]) // Set empty array on error
      }
    } finally {
      setLoading(false)
      setLoadingOlder(false)
    }
  }

  async function assignToMe() {
    if (!sessionId || !agentId) {
      alert('Please enter an agent ID')
      return
    }
    
    try {
      // Ensure socket is connected and registered as agent
      if (!socket) {
        alert('Socket not connected. Please wait...')
        return
      }
      
      if (!socket.connected) {
        alert('Socket not connected. Please refresh the page.')
        return
      }
      
      // Connect as agent FIRST (this registers the socket in agentSockets map)
      console.log(`👤 Connecting as agent: ${agentId}`)
      socket.emit('agent_connect', { agentId })
      
      // Wait a bit for connection to register
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Assign session via API
      const res = await fetch(`${API_BASE}/admin/sessions/${sessionId}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agentId })
      })
      const data = await res.json()
      if (data.success) {
        console.log('✅ Session assigned via API')
        
        // Also emit takeover event
        socket.emit('agent_takeover', { sessionId, agentId })
        console.log('✅ Emitted agent_takeover event')
        
        // Reload messages to get latest
        loadMessages()
      } else {
        alert('Failed to assign session: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Failed to assign session:', err)
      alert('Failed to assign session: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

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

  // Export conversation
  async function exportConversation(format: 'json' | 'csv') {
    if (!sessionId) return
    
    setExporting(true)
    setShowExportMenu(false)
    
    try {
      const res = await fetch(`${API_BASE}/admin/sessions/${sessionId}/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`
        }
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
      setExporting(false)
    }
  }

  async function closeConversation() {
    if (!sessionId) return
    
    if (!confirm('Are you sure you want to close this conversation? This will prevent further messages from being sent.')) {
      return
    }
    
    try {
      const res = await fetch(`${API_BASE}/admin/sessions/${sessionId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await res.json()
      if (data.success) {
        setSessionStatus('closed')
        console.log('✅ Conversation closed successfully')
        // Reload session info to refresh status
        await loadSessionInfo()
        // Show success message
        alert('Conversation closed successfully. The session will now appear in the "Closed" filter.')
      } else {
        alert('Failed to close conversation: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Failed to close conversation:', err)
      alert('Failed to close conversation: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  function sendMessage() {
    if (!sessionId || !messageText.trim() || !agentId) {
      alert('Please enter agent ID and message')
      return
    }
    
    if (sessionStatus === 'closed') {
      alert('This conversation is closed. Cannot send messages.')
      return
    }
    
    if (socket) {
      socket.emit('agent_message', { sessionId, text: messageText.trim(), agentId })
      setMessages(prev => [...prev, { sender: 'agent', text: messageText.trim(), timestamp: new Date().toISOString(), agentId }])
      setMessageText('')
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px', marginRight: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 style={{ display: 'inline', marginLeft: '10px' }}>Session: {sessionId}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {sessionStatus && (
            <span style={{
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '13px',
              background: sessionStatus === 'active' ? '#d4edda' : sessionStatus === 'agent_assigned' ? '#d1ecf1' : sessionStatus === 'closed' ? '#f8d7da' : '#e2e3e5',
              color: sessionStatus === 'active' ? '#155724' : sessionStatus === 'agent_assigned' ? '#0c5460' : sessionStatus === 'closed' ? '#721c24' : '#383d41'
            }}>
              {sessionStatus}
            </span>
          )}
          {hasAnyRole(['admin', 'super_admin']) && (
            <div style={{ position: 'relative', display: 'inline-block' }} data-export-menu>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting}
                style={{
                  padding: '8px 16px',
                  background: exporting ? '#ccc' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                {exporting ? 'Exporting...' : 'Export'}
              </button>
              {showExportMenu && (
                <div
                  data-export-menu
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
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
                    onClick={() => exportConversation('json')}
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
                    onClick={() => exportConversation('csv')}
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
              )}
            </div>
          )}
          {hasAnyRole(['agent', 'admin', 'super_admin']) && (
            <>
              <input
                type="text"
                placeholder="Agent ID"
                value={agentId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentId(e.target.value)}
                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '120px', marginLeft: '10px' }}
              />
              {assignedAgentId && assignedAgentId === agentId ? (
                <>
                  <button onClick={closeConversation} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' }}>
                    Close Conversation
                  </button>
                  <span style={{ fontSize: '13px', color: '#28a745', fontWeight: '500', marginLeft: '10px' }}>✓ Assigned</span>
                </>
              ) : (
                <button onClick={assignToMe} style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' }}>
                  Assign to Me
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', minHeight: '400px', maxHeight: '600px', overflow: 'auto' }}>
        {loading ? (
          <div>Loading messages...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Load older messages button */}
            {messageTotal > messages.length && messageLimit < 10000 && (
              <div style={{ textAlign: 'center', padding: '10px' }}>
                <button
                  onClick={() => loadMessages(true)}
                  disabled={loadingOlder}
                  style={{
                    padding: '8px 16px',
                    background: loadingOlder ? '#ccc' : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loadingOlder ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {loadingOlder ? 'Loading...' : `Load Older Messages (${messageTotal - messages.length} remaining)`}
                </button>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: msg.sender === 'user' ? '#667eea' : msg.sender === 'agent' ? '#28a745' : msg.sender === 'bot' ? '#6c757d' : '#f8f9fa',
                  color: msg.sender === 'user' ? 'white' : msg.sender === 'bot' ? 'white' : '#333',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '70%'
                }}
              >
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px', fontWeight: '500' }}>
                  {msg.sender === 'bot' ? '🤖 Bot' : msg.sender === 'agent' ? `👤 Agent${msg.agentId ? ` (${msg.agentId})` : ''}` : '👤 User'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</div>
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="Type your message..."
          value={messageText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessageText(e.target.value)}
          onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && sendMessage()}
          style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
        />
        <button
          onClick={sendMessage}
          disabled={!agentId || !messageText.trim()}
          style={{
            padding: '10px 20px',
            background: agentId && messageText.trim() ? '#28a745' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: agentId && messageText.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

