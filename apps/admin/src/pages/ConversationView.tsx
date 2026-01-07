import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'
import ImageAnnotationModal from '../components/ImageAnnotationModal'
import { useAppwriteUpload } from '../hooks/useAppwriteUpload'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me'

interface Message {
  sender: 'user' | 'agent' | 'bot' | 'internal' | 'system'
  text: string
  timestamp: string
  agentId?: string
  type?: string
  attachmentUrl?: string
}

export default function ConversationView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { hasRole, hasAnyRole, user, token } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [agentId, setAgentId] = useState('')
  const [messageText, setMessageText] = useState('')
  const [isPrivateNote, setIsPrivateNote] = useState(false)
  const [socket, setSocket] = useState<any>(null)
  const [sessionStatus, setSessionStatus] = useState<string>('')
  const [assignedAgentId, setAssignedAgentId] = useState<string>('')
  const [onlineAgents, setOnlineAgents] = useState<Array<{ userId: string; name: string; email: string; isOnline?: boolean; status?: string }>>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [loadingAgents, setLoadingAgents] = useState(false)

  // Check if current user can send messages (agent or admin)
  const canSendMessages = hasAnyRole(['agent', 'admin'])
  const isAdmin = hasRole('admin')
  const isAgent = hasRole('agent')

  // Debug logging for close button visibility
  useEffect(() => {
    console.log(`🔍 Close button check: assignedAgentId=${assignedAgentId}, canSendMessages=${canSendMessages}, user.roles=${user?.roles?.join(',') || 'none'}`)
  }, [assignedAgentId, canSendMessages, user?.roles])
  const [exporting, setExporting] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Message pagination state
  const [messageLimit, setMessageLimit] = useState(100) // Default: load all
  const [messageOffset, setMessageOffset] = useState(0)
  const [messageTotal, setMessageTotal] = useState(0)

  // Image annotation state
  const [showAnnotationModal, setShowAnnotationModal] = useState(false)
  const [imageToAnnotate, setImageToAnnotate] = useState<string | null>(null)
  const [hoveredImageUrl, setHoveredImageUrl] = useState<string | null>(null)
  const [annotatedImageBlob, setAnnotatedImageBlob] = useState<Blob | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [imageToView, setImageToView] = useState<string | null>(null)
  const { uploadAnnotatedImage } = useAppwriteUpload()

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
    const sock = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    })

    sock.on('connect', () => {
      console.log('✅ Socket connected')
      // CRITICAL: Join session room to receive real-time updates (user messages, agent messages, bot messages)
      if (sessionId) {
        sock.emit('join_session', { sessionId })
        console.log(`📱 Admin socket joined session room: ${sessionId}`)
      }
      // Join admin feed to receive agent online/offline updates
      if (isAdmin) {
        sock.emit('join_admin_feed')
        console.log('📤 Joined admin feed for agent status updates')
      }
      // Auto-connect as agent if session has assigned agent and current user matches
      const currentUserId = user?.userId
      if (assignedAgentId && currentUserId === assignedAgentId) {
        setAgentId(assignedAgentId)
        sock.emit('agent_connect', { agentId: assignedAgentId })
        console.log(`👤 Auto-connected as assigned agent: ${assignedAgentId}`)
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
            m.attachmentUrl === data.attachmentUrl &&
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
            agentId: data.agentId,
            type: data.type,
            attachmentUrl: data.attachmentUrl
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

    // Listen for internal notes (private agent messages)
    sock.on('internal_note', (data: any) => {
      console.log('📨 Received internal_note:', data)
      if (data.sessionId === sessionId || !data.sessionId) {
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          const exists = prev.some(m =>
            m.sender === 'internal' &&
            m.text === data.text &&
            Math.abs(new Date(m.timestamp).getTime() - (data.ts || Date.now())) < 2000
          )
          if (exists) {
            console.log('   ⚠️  Duplicate internal note, skipping')
            return prev
          }
          console.log('   ✅ Adding internal note to UI')
          return [...prev, {
            sender: 'internal',
            text: data.text,
            timestamp: new Date(data.ts || Date.now()).toISOString(),
            agentId: data.agentId
          }]
        })
      } else {
        console.log(`   ⚠️  Internal note for different session: ${data.sessionId} (current: ${sessionId})`)
      }
    })

    // Listen for agent online/offline status updates (admin only)
    if (isAdmin) {
      sock.on('agent_connected', (data: any) => {
        console.log('📨 Received agent_connected:', data)
        // Refresh the online agents list when an agent connects
        loadOnlineAgents()
      })

      sock.on('agent_disconnected', (data: any) => {
        console.log('📨 Received agent_disconnected:', data)
        // Refresh the online agents list when an agent disconnects
        loadOnlineAgents()
      })

      sock.on('agent_status_changed', (data: any) => {
        console.log('📨 Received agent_status_changed:', data)
        // Refresh the online agents list when agent status changes
        loadOnlineAgents()
      })
    }

    setSocket(sock)

    return () => {
      sock.disconnect()
    }
  }, [sessionId, assignedAgentId, user])

  // Auto-fill agentId when assignedAgentId is set (ensures Send button is enabled)
  // This handles both assignment methods: Initiate Chat and manual assignment
  useEffect(() => {
    if (assignedAgentId) {
      // Always set agentId to match assignedAgentId (enables Send button)
      setAgentId(assignedAgentId)
      console.log(`✅ Auto-filled agentId from assignedAgentId: ${assignedAgentId}`)
    }
  }, [assignedAgentId])

  // Fetch all agents for admin dropdown (only online agents)
  const loadOnlineAgents = async () => {
    if (!isAdmin) return

    setLoadingAgents(true)
    try {
      const res = await fetch(`${API_BASE}/admin/users/agents`, {
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include'
      })

      if (!res.ok) {
        throw new Error('Failed to load agents')
      }

      const data = await res.json()
      const allAgents = data.agents || []

      // Debug: Log all agents and their online status
      console.log(`📊 All agents received:`, allAgents.map((a: any) => ({
        userId: a.userId,
        name: a.name,
        email: a.email,
        isOnline: a.isOnline,
        status: a.status
      })))

      // Filter: Only show agents who are:
      // 1. Currently online (have active socket connections) AND
      // 2. Have status === 'online' (not 'away' or null)
      const onlineAgentsFiltered = allAgents.filter((agent: any) => {
        const hasSocketConnection = agent.isOnline === true
        const hasOnlineStatus = agent.status === 'online'

        // Must have BOTH socket connection AND status === 'online'
        const isOnline = hasSocketConnection && hasOnlineStatus

        if (!isOnline) {
          console.log(`   ⚠️  Filtering out agent: ${agent.userId} (${agent.email}) - isOnline=${hasSocketConnection}, status=${agent.status}`)
        }

        return isOnline
      })

      // Sort by name for easier selection
      const sortedAgents = onlineAgentsFiltered.sort((a: any, b: any) => {
        const nameA = (a.name || a.email || '').toLowerCase()
        const nameB = (b.name || b.email || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })

      // CRITICAL: Set state with filtered online agents only
      setOnlineAgents(sortedAgents)
      console.log(`✅ Loaded ${sortedAgents.length} online agent(s) out of ${allAgents.length} total`)
      console.log(`📋 Setting onlineAgents state with:`, sortedAgents.map(a => ({
        userId: a.userId,
        name: a.name,
        email: a.email,
        isOnline: a.isOnline,
        status: a.status
      })))
      if (sortedAgents.length === 0 && allAgents.length > 0) {
        console.warn(`⚠️  WARNING: No online agents found, but ${allAgents.length} total agent(s) exist. Check backend logs for agent connection status.`)
      }
    } catch (err) {
      console.error('Failed to load agents:', err)
    } finally {
      setLoadingAgents(false)
    }
  }

  // Load online agents when component mounts (for admins)
  // Note: Socket events (agent_connected, agent_disconnected, agent_status_changed) handle real-time updates
  useEffect(() => {
    if (isAdmin && sessionId) {
      loadOnlineAgents()
      // No periodic polling needed - socket events handle agent status changes
    }
  }, [isAdmin, sessionId])

  // Also refresh when dropdown is opened (on focus)
  const handleDropdownFocus = () => {
    if (isAdmin) {
      loadOnlineAgents()
    }
  }

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
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include' // Include cookies as fallback
      })
      const data = await res.json()
      // The API returns items, not sessions
      const session = (data.items || data.sessions || []).find((s: any) => s.sessionId === sessionId)

      if (session) {
        setSessionStatus(session.status || '')

        // Extract assignedAgent from session
        // The API endpoint already extracts assignedAgent from userMeta and sets it on the session object
        let agent = session.assignedAgent || null
        console.log(`🔍 Session data check: assignedAgent=${session.assignedAgent}, userMeta=${session.userMeta ? 'exists' : 'null'}, status=${session.status}`)

        if (!agent && session.userMeta) {
          try {
            const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta
            console.log(`🔍 Parsed userMeta:`, userMeta)
            if (userMeta?.assignedAgent) {
              agent = userMeta.assignedAgent
              console.log(`✅ Found assignedAgent in userMeta: ${agent}`)
            }
          } catch (e) {
            console.error(`❌ Error parsing userMeta:`, e)
          }
        }

        if (agent) {
          setAssignedAgentId(agent)
          // Always auto-fill agentId when assignedAgent is found (enables Send button)
          setAgentId(agent)
          const currentUserId = user?.userId
          if (currentUserId && currentUserId === agent) {
            console.log(`✅ Found assigned agent: ${agent} (matches current user - auto-connected)`)
          } else {
            console.log(`✅ Found assigned agent: ${agent} (auto-filled agentId field)`)
          }
          console.log(`🔍 Close button check: assignedAgentId=${agent}, canSendMessages=${canSendMessages}, user.roles=${user?.roles?.join(',') || 'none'}`)
        } else {
          console.log(`⚠️  No assigned agent found for session ${sessionId}`)
          console.log(`   Full session object:`, JSON.stringify(session, null, 2))
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
          'Authorization': `Bearer ${token || ADMIN_SECRET}`
        },
        credentials: 'include' // Include cookies as fallback
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
        let metadata: { agentId?: string } = {}
        if (msg.metadata) {
          try {
            const parsed = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata
            metadata = parsed as { agentId?: string }
          } catch (e) {
            // Ignore parse errors
            metadata = {}
          }
        }

        return {
          sender: msg.sender || 'unknown',
          text: msg.text || '',
          timestamp: msg.createdAt || msg.timestamp || msg.$createdAt || new Date().toISOString(),
          agentId: metadata?.agentId || undefined,
          type: msg.type || undefined,
          attachmentUrl: msg.attachmentUrl || undefined
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
    try {
      const agentId = user?.userId
      if (!agentId) {
        alert('Cannot assign: User ID not found')
        return
      }

      const agentName = user?.name || user?.email || agentId
      await assignSession(agentId, agentName)
    } catch (err) {
      console.error('Failed to assign session:', err)
      alert('Failed to assign session: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  async function assignToSelectedAgent() {
    if (!selectedAgentId) {
      alert('Please select an agent from the dropdown')
      return
    }

    const selectedAgent = onlineAgents.find(a => a.userId === selectedAgentId)
    const agentName = selectedAgent?.name || selectedAgent?.email || selectedAgentId

    await assignSession(selectedAgentId, agentName)
  }

  async function assignSession(agentId: string, agentName: string) {
    try {
      if (!agentId) {
        alert('Cannot assign: Agent ID not found')
        return
      }

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

      // Assign session via API with agentName
      const res = await fetch(`${API_BASE}/admin/sessions/${sessionId}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies as fallback
        body: JSON.stringify({ agentId, agentName })
      })
      const data = await res.json()
      if (data.success) {
        console.log('✅ Session assigned via API')

        // Update assignedAgentId state immediately so close button appears
        setAssignedAgentId(agentId)
        setAgentId(agentId) // Also update agentId for sending messages
        setSelectedAgentId('') // Reset dropdown selection

        // Also emit takeover event
        socket.emit('agent_takeover', { sessionId, agentId })
        console.log('✅ Emitted agent_takeover event')

        // Reload session info to get latest status and assignment
        await loadSessionInfo()

        // Reload messages to get latest (including system message)
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
          'Authorization': `Bearer ${token || ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Include cookies as fallback
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

  async function sendMessage() {
    if (!sessionId || isSending) return;

    // Check if we have anything to send (text OR an annotated image)
    const hasText = !!messageText.trim();
    const hasImage = !!annotatedImageBlob;

    if (!hasText && !hasImage) {
      alert('Please enter a message or attach an annotated image')
      return
    }

    // Use current user's ID if agentId is not set but user has permission
    const effectiveAgentId = agentId || (canSendMessages && user?.userId ? user.userId : null)
    if (!effectiveAgentId) {
      alert('Agent ID is required')
      return
    }

    if (sessionStatus === 'closed') {
      alert('This conversation is closed. Cannot send messages.')
      return
    }

    if (socket) {
      setIsSending(true);
      try {
        let attachmentUrl = undefined;
        let messageType = 'text';

        // If there's an annotated image, upload it first
        if (annotatedImageBlob) {
          try {
            attachmentUrl = await uploadAnnotatedImage(annotatedImageBlob);
            messageType = 'image';
          } catch (uploadErr) {
            alert('Failed to upload annotated image: ' + (uploadErr instanceof Error ? uploadErr.message : 'Unknown error'));
            setIsSending(false);
            return;
          }
        }

        if (isPrivateNote) {
          // Send as internal note (private, only visible to agents)
          const payload = {
            sessionId,
            text: messageText.trim() || 'Annotated Image',
            agentId: effectiveAgentId,
            type: messageType,
            attachmentUrl
          };
          socket.emit('internal_note', payload)
          setMessages(prev => [...prev, {
            sender: 'internal',
            text: payload.text,
            timestamp: new Date().toISOString(),
            agentId: effectiveAgentId,
            type: messageType,
            attachmentUrl
          }])
        } else {
          // Send as regular agent message (visible to user)
          const payload = {
            sessionId,
            text: messageText.trim() || 'Image',
            agentId: effectiveAgentId,
            type: messageType,
            attachmentUrl
          };
          socket.emit('agent_message', payload)
          setMessages(prev => [...prev, {
            sender: 'agent',
            text: payload.text,
            timestamp: new Date().toISOString(),
            agentId: effectiveAgentId,
            type: messageType,
            attachmentUrl
          }])
        }

        // Success: Clear state
        setMessageText('')
        setAnnotatedImageBlob(null)
        setIsPrivateNote(false) // Reset toggle after sending
      } catch (err) {
        console.error('Error sending message:', err);
        alert('Failed to send message: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsSending(false);
      }
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '8px 16px',
              marginRight: '10px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
          <h1 style={{ display: 'inline', marginLeft: '10px', marginRight: '10px' }}>Session: {sessionId}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {(hasRole('admin') || hasRole('agent')) && (
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
          {/* Refresh button - always visible for all sessions */}
          <button
            onClick={() => {
              // Reload latest session info and messages
              loadSessionInfo()
              loadMessages(false)
            }}
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              marginLeft: '10px'
            }}
            title="Refresh chat messages and session data"
          >
            🔄 Refresh
          </button>
          {hasAnyRole(['agent', 'admin']) && (
            <>
              {isAdmin && !assignedAgentId && (() => {
                // Debug: Log rendering state
                console.log('🎨 Rendering dropdown with:', {
                  onlineAgents: onlineAgents.length,
                  loadingAgents,
                  selectedAgentId,
                  hasAgents: onlineAgents.length > 0
                })

                // Only disable if actively loading AND no agents available yet
                // If agents are available, enable the dropdown even if loading (for real-time updates)
                const shouldDisable = loadingAgents && onlineAgents.length === 0

                return (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '10px' }}>
                    <select
                      key={`agent-select-${onlineAgents.length}`} // Force re-render when onlineAgents changes
                      value={selectedAgentId || ''} // Ensure value is never null/undefined
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      onFocus={handleDropdownFocus}
                      disabled={shouldDisable} // Only disable when loading AND no agents available
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        minWidth: '200px',
                        background: shouldDisable ? '#f5f5f5' : 'white',
                        cursor: shouldDisable ? 'not-allowed' : 'pointer',
                        opacity: shouldDisable ? 0.6 : 1
                      }}
                    >
                      <option value="">Select an agent...</option>
                      {onlineAgents.length === 0 ? (
                        <option value="" disabled>
                          {loadingAgents ? 'Loading agents...' : 'No agents online'}
                        </option>
                      ) : (
                        // Display ONLY online agents (already filtered in loadOnlineAgents)
                        onlineAgents.map((agent) => {
                          const displayName = agent.name || agent.email || 'Unknown'

                          // Double-check: log if somehow a non-online agent got through
                          if (agent.isOnline !== true || agent.status !== 'online') {
                            console.warn(`⚠️  WARNING: Rendering non-online agent in dropdown: ${agent.userId} (isOnline=${agent.isOnline}, status=${agent.status})`)
                          }

                          return (
                            <option key={agent.userId} value={agent.userId}>
                              🟢 {displayName}
                            </option>
                          )
                        })
                      )}
                    </select>
                    <button
                      onClick={assignToSelectedAgent}
                      disabled={!selectedAgentId || loadingAgents}
                      style={{
                        padding: '8px 16px',
                        background: selectedAgentId && !loadingAgents ? '#28a745' : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: selectedAgentId && !loadingAgents ? 'pointer' : 'not-allowed',
                        fontSize: '14px'
                      }}
                    >
                      Assign
                    </button>
                  </div>
                )
              })()}
              {assignedAgentId && canSendMessages && sessionStatus === 'agent_assigned' ? (
                <>
                  <button onClick={closeConversation} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' }}>
                    Close Conversation
                  </button>
                  {assignedAgentId === agentId && (
                    <span style={{ fontSize: '13px', color: '#28a745', fontWeight: '500', marginLeft: '10px' }}>✓ Assigned</span>
                  )}
                </>
              ) : assignedAgentId ? (
                <>
                  <span style={{ fontSize: '13px', color: '#6c757d', marginLeft: '10px' }}>
                    Assigned to: {assignedAgentId}
                  </span>
                  {/* Only show reassign button if current user is NOT the assigned agent */}
                  {user?.userId !== assignedAgentId && (
                    <button onClick={assignToMe} style={{ padding: '8px 16px', background: '#ffc107', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' }}>
                      Reassign to Me
                    </button>
                  )}
                  {/* If current user IS the assigned agent, show they're assigned */}
                  {user?.userId === assignedAgentId && (
                    <span style={{ fontSize: '13px', color: '#28a745', fontWeight: '500', marginLeft: '10px' }}>✓ You are assigned</span>
                  )}
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
                  background: msg.sender === 'user' ? '#667eea' :
                    msg.sender === 'agent' ? '#28a745' :
                      msg.sender === 'bot' ? '#6c757d' :
                        msg.sender === 'internal' ? '#fff3cd' :
                          msg.sender === 'system' ? '#e7f3ff' : '#f8f9fa',
                  color: msg.sender === 'user' ? 'white' :
                    msg.sender === 'bot' ? 'white' :
                      msg.sender === 'internal' ? '#856404' :
                        msg.sender === 'system' ? '#004085' : '#333',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  border: msg.sender === 'internal' ? '2px dashed #ffc107' : 'none'
                }}
              >
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px', fontWeight: '500' }}>
                  {msg.sender === 'bot' ? '🤖 Bot' :
                    msg.sender === 'agent' ? `👤 Agent${msg.agentId ? ` (${msg.agentId})` : ''}` :
                      msg.sender === 'internal' ? '🔒 Private Note' :
                        msg.sender === 'system' ? 'ℹ️ System' :
                          '👤 User'}
                </div>
                {/* Image Attachment Rendering */}
                {msg.type === 'image' && msg.attachmentUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        position: 'relative',
                        maxWidth: '250px',
                        display: 'inline-block'
                      }}
                      onMouseEnter={() => msg.sender === 'user' && setHoveredImageUrl(msg.attachmentUrl!)}
                      onMouseLeave={() => setHoveredImageUrl(null)}
                    >
                      <div
                        onClick={() => {
                          setImageToView(msg.attachmentUrl!);
                          setShowImageViewer(true);
                        }}
                        style={{
                          display: 'block',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          position: 'relative'
                        }}
                      >
                        <img
                          src={msg.attachmentUrl}
                          alt="User attachment"
                          style={{
                            width: '100%',
                            maxWidth: '250px',
                            height: 'auto',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 0, 0, 0.1)',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                      </div>
                      {/* Hover Overlay for User Images */}
                      {msg.sender === 'user' && hoveredImageUrl === msg.attachmentUrl && canSendMessages && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 10
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setImageToView(msg.attachmentUrl!);
                                setShowImageViewer(true);
                              }}
                              style={{
                                padding: '10px 15px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              👁️ View
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setImageToAnnotate(msg.attachmentUrl!);
                                setShowAnnotationModal(true);
                              }}
                              style={{
                                padding: '10px 15px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              ✏️ Reply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {msg.text && msg.text !== 'Image' && (
                      <div style={{ fontSize: '13px', lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {msg.text}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</div>
                )}
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Private Note Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#666' }}>
            <input
              type="checkbox"
              checked={isPrivateNote}
              onChange={(e) => setIsPrivateNote(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <span>🔒 Private Note (only visible to agents)</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Type your message..."
            value={messageText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessageText(e.target.value)}
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && sendMessage()}
            disabled={!canSendMessages || isSending}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: isSending ? '#f5f5f5' : 'white',
              cursor: isSending ? 'not-allowed' : 'text'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!canSendMessages || (isSending) || (!messageText.trim() && !annotatedImageBlob)}
            style={{
              padding: '10px 20px',
              background: canSendMessages && (messageText.trim() || annotatedImageBlob) && !isSending ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: canSendMessages && (messageText.trim() || annotatedImageBlob) && !isSending ? 'pointer' : 'not-allowed'
            }}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {showImageViewer && imageToView && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            cursor: 'zoom-out',
            padding: '20px'
          }}
          onClick={() => setShowImageViewer(false)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'default'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowImageViewer(false)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                fontSize: '20px',
                zIndex: 2001
              }}
            >
              ×
            </button>
            <img
              src={imageToView}
              alt="Full view"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                objectFit: 'contain'
              }}
            />
            <div style={{
              marginTop: '15px',
              display: 'flex',
              gap: '15px'
            }}>
              <a
                href={imageToView}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '14px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  padding: '5px 12px',
                  borderRadius: '4px'
                }}
              >
                Open in new tab ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Image Annotation Modal */}
      {showAnnotationModal && imageToAnnotate && (
        <ImageAnnotationModal
          imageUrl={imageToAnnotate}
          onClose={() => {
            setShowAnnotationModal(false);
            setImageToAnnotate(null);
          }}
          onSave={async (blob) => {
            setAnnotatedImageBlob(blob);
            console.log('✅ Annotated image ready to send');
          }}
        />
      )}

      {/* Annotated Image Preview (above input field) */}
      {annotatedImageBlob && (
        <div style={{
          position: 'absolute',
          bottom: '70px',
          left: '20px',
          backgroundColor: 'white',
          padding: '10px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 100
        }}>
          <img
            src={URL.createObjectURL(annotatedImageBlob)}
            alt="Annotated preview"
            style={{
              width: '60px',
              height: '60px',
              objectFit: 'cover',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          />
          <span style={{ fontSize: '13px', color: '#666' }}>
            Annotated image attached
          </span>
          <button
            onClick={() => setAnnotatedImageBlob(null)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ✕ Remove
          </button>
        </div>
      )}
    </div>
  )
}

