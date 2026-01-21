import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'
import ImageAnnotationModal from '../components/ImageAnnotationModal'
import { useAppwriteUpload } from '../hooks/useAppwriteUpload'
import { useTyping } from '../hooks/useTyping'
import { ChevronDown, Circle, Check, User } from 'lucide-react'

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
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)

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

  // Slash commands (Canned Responses) state
  interface CannedResponse {
    $id: string
    shortcut: string
    category?: string
    content: string
  }
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<CannedResponse[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [slashTrigger, setSlashTrigger] = useState<{ start: number; end: number; searchTerm: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (showExportMenu && !target.closest('[data-export-menu]')) {
        setShowExportMenu(false)
      }
      if (showAgentDropdown && !target.closest('[data-agent-dropdown]')) {
        setShowAgentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportMenu, showAgentDropdown])

  // Fetch canned responses on mount
  useEffect(() => {
    async function fetchCannedResponses() {
      try {
        const authToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
        const response = await fetch(`${API_BASE}/api/canned-responses`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        })
        if (response.ok) {
          const data = await response.json()
          // API returns { responses: [...], total: number } or { documents: [...] } or array
          const documents = data.responses || data.documents || data.items || (Array.isArray(data) ? data : [])
          setCannedResponses(Array.isArray(documents) ? documents : [])
        } else {
          // On error, ensure we have an empty array
          setCannedResponses([])
        }
      } catch (err) {
        console.error('Failed to fetch canned responses:', err)
        // On error, ensure we have an empty array
        setCannedResponses([])
      }
    }
    fetchCannedResponses()
  }, [token])

  // Detect slash commands in messageText
  useEffect(() => {
    const cursorPos = textareaRef.current?.selectionStart ?? messageText.length
    const textBeforeCursor = messageText.substring(0, cursorPos)

    // Check for slash at start or after space
    const slashAtStart = textBeforeCursor.match(/^\/\w*$/)
    const slashAfterSpace = textBeforeCursor.match(/\s\/\w*$/)

    if (slashAtStart || slashAfterSpace) {
      const match = slashAtStart || slashAfterSpace
      if (match) {
        const searchTerm = match[0].replace(/^\s*\//, '').toLowerCase()
        const startPos = cursorPos - match[0].length
        const endPos = cursorPos

        setSlashTrigger({ start: startPos, end: endPos, searchTerm })

        // Filter suggestions - with safety check
        if (Array.isArray(cannedResponses) && cannedResponses.length > 0) {
          const filtered = cannedResponses.filter(resp =>
            resp && resp.shortcut && resp.shortcut.toLowerCase().startsWith(searchTerm)
          )
          setSuggestions(filtered)
          setShowSuggestions(filtered.length > 0)
          setSelectedSuggestionIndex(0)
        } else {
          setSuggestions([])
          setShowSuggestions(false)
        }
      }
    } else {
      setShowSuggestions(false)
      setSlashTrigger(null)
    }
  }, [messageText, cannedResponses])

  // Handle keyboard navigation for suggestions
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // If suggestions are showing, handle navigation
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedSuggestionIndex(prev =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          )
          return
        case 'ArrowUp':
          e.preventDefault()
          setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0)
          return
        case 'Enter':
          e.preventDefault()
          if (suggestions[selectedSuggestionIndex]) {
            selectCannedResponse(suggestions[selectedSuggestionIndex])
          }
          return
        case 'Tab':
          e.preventDefault()
          if (suggestions[selectedSuggestionIndex]) {
            selectCannedResponse(suggestions[selectedSuggestionIndex])
          }
          return
        case 'Escape':
          e.preventDefault()
          setShowSuggestions(false)
          setSlashTrigger(null)
          return
      }
    }

    // If no suggestions, handle Enter for sending (Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Select a canned response and replace trigger text
  function selectCannedResponse(response: CannedResponse) {
    if (!slashTrigger) return

    const beforeTrigger = messageText.substring(0, slashTrigger.start)
    const afterTrigger = messageText.substring(slashTrigger.end)
    const newText = beforeTrigger + response.content + afterTrigger

    setMessageText(newText)
    setShowSuggestions(false)
    setSlashTrigger(null)

    // Focus textarea and move cursor to end of inserted content
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeTrigger.length + response.content.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  // Initialize typing indicator hook
  const currentUser = {
    name: user?.name || user?.email || 'Agent',
    role: isAgent ? 'agent' : isAdmin ? 'admin' : 'user'
  }
  const { remoteTypingUser, handleInput: handleTypingInput } = useTyping({
    socket,
    sessionId,
    currentUser
  })

  // Scroll to bottom when typing indicator appears
  useEffect(() => {
    if (remoteTypingUser && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [remoteTypingUser])

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

    setSocket(sock)

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
        loadOnlineAgents()
      })

      sock.on('agent_disconnected', (data: any) => {
        console.log('📨 Received agent_disconnected:', data)
        loadOnlineAgents()
      })

      sock.on('agent_status_changed', (data: any) => {
        console.log('📨 Received agent_status_changed:', data)
        loadOnlineAgents()
      })
    }

    // Listen for incoming User messages
    sock.on('new_message', (data: any) => {
      if (data.sessionId === sessionId) {
        console.log('📨 Received new_message (user):', data)
        setMessages(prev => {
          // Prevent duplicates
          const exists = prev.some(m =>
            m.text === data.text &&
            m.sender === 'user' &&
            Math.abs(new Date(m.timestamp).getTime() - new Date(data.createdAt || Date.now()).getTime()) < 2000
          );
          if (exists) return prev;

          return [...prev, {
            sender: 'user',
            text: data.text,
            timestamp: data.createdAt || new Date().toISOString(),
            agentId: null
          }]
        })
      }
    })

    // Listen for incoming Bot messages
    sock.on('bot_message', (data: any) => {
      console.log('📨 Received bot_message:', data)
      setMessages(prev => {
        // Prevent duplicates
        const exists = prev.some(m =>
          m.text === data.text &&
          m.sender === 'bot' &&
          Math.abs(new Date(m.timestamp).getTime() - Date.now()) < 5000
        );
        if (exists) return prev;

        return [...prev, {
          sender: 'bot',
          text: data.text,
          timestamp: new Date().toISOString(),
          agentId: null
        }]
      })
    })

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

      // Filter: Show all agents (don't filter offline ones)
      // We want to give admin ability to assign to anyone
      const onlineAgentsFiltered = allAgents;

      // Sort: Online agents first, then by name
      const sortedAgents = onlineAgentsFiltered.sort((a: any, b: any) => {
        // Sort by online status first (just isOnline check)
        const aOnline = a.isOnline === true;
        const bOnline = b.isOnline === true;

        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
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
  // Note: Socket events (agent_connected, agent_disconnected, agent_status_changed) are received for refreshing online agents list
  // These are confirmation messages sent to the specific socket, not broadcast notifications
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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        {/* Left Side: Back & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sessions')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span>←</span>
            <span>Back</span>
          </button>

          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Session <span className="font-mono text-lg opacity-70">#{sessionId?.slice(-6)}</span>
            </h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit mt-1 ${sessionStatus === 'closed' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                sessionStatus === 'active' || sessionStatus === 'agent_assigned' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
              {sessionStatus === 'agent_assigned' ? 'Agent Assigned' :
                sessionStatus === 'active' ? 'Active' :
                  sessionStatus}
            </span>
          </div>
        </div>

        {/* Right Side: Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Export Button */}
          {(hasRole('admin') || hasRole('agent')) && (
            <div className="relative" data-export-menu>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${exporting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <span>{exporting ? 'Exporting...' : 'Export'}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-50" />
              </button>

              {showExportMenu && (
                <div className="absolute top-full right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => exportConversation('json')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => exportConversation('csv')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700 transition-colors"
                  >
                    CSV
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => {
              loadSessionInfo()
              loadMessages(false)
            }}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <span className="text-xl">↻</span>
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

          {/* Agent Assignment Logic */}
          {hasAnyRole(['agent', 'admin']) && (
            <>
              {/* Admin Agent Dropdown */}
              {isAdmin && !assignedAgentId && (
                (() => {
                  const shouldDisable = loadingAgents && onlineAgents.length === 0
                  return (
                    <div className="relative" data-agent-dropdown>
                      <button
                        onClick={() => {
                          if (!shouldDisable) {
                            setShowAgentDropdown(!showAgentDropdown)
                            if (!showAgentDropdown) handleDropdownFocus()
                          }
                        }}
                        disabled={shouldDisable}
                        className={`flex items-center justify-between px-3 py-2 text-sm border rounded-lg min-w-[180px] transition-colors ${shouldDisable
                            ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-gray-400'
                          }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden max-w-[140px]">
                          {(() => {
                            const selected = onlineAgents.find(a => a.userId === selectedAgentId)
                            if (selected) {
                              return (
                                <>
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selected.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                                  <span className="truncate">{selected.name || selected.email}</span>
                                </>
                              )
                            }
                            return <span className="text-gray-500">Select agent...</span>
                          })()}
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>

                      {showAgentDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-[300px] overflow-y-auto">
                          {onlineAgents.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">No agents found</div>
                          ) : (
                            <div className="py-1">
                              {onlineAgents.map(agent => (
                                <button
                                  key={agent.userId}
                                  onClick={() => {
                                    if (agent.isOnline) {
                                      setSelectedAgentId(agent.userId)
                                      setShowAgentDropdown(false)
                                    }
                                  }}
                                  disabled={!agent.isOnline}
                                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedAgentId === agent.userId ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-700 dark:text-gray-200'
                                    } ${!agent.isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <div className={`w-2 h-2 rounded-full ${agent.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    <span className="truncate">{agent.name || agent.email}</span>
                                  </div>
                                  {selectedAgentId === agent.userId && <Check className="w-3 h-3" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()
              )}

              {/* Assign/Reassign Buttons */}
              {isAdmin && !assignedAgentId && (
                <button
                  onClick={assignToSelectedAgent}
                  disabled={!selectedAgentId}
                  className={`px-3 py-2 text-sm font-medium rounded-lg text-white transition-colors ${!selectedAgentId
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 shadow-sm'
                    }`}
                >
                  Assign
                </button>
              )}

              {/* Close Conversation Button */}
              {assignedAgentId && canSendMessages && (sessionStatus === 'agent_assigned' || sessionStatus === 'active') && (
                <button
                  onClick={closeConversation}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-sm font-medium rounded-lg transition-all shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Close Chat
                </button>
              )}

              {/* Status Indicators / Self Assign */}
              {!assignedAgentId && (
                <button
                  onClick={assignToMe}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                >
                  Take Over
                </button>
              )}

              {assignedAgentId && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ml-2">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {assignedAgentId === user?.userId ? 'You' : assignedAgentId}
                  </span>
                  {assignedAgentId !== user?.userId && (
                    <button
                      onClick={assignToMe}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-1 underline"
                    >
                      Take Over
                    </button>
                  )}
                </div>
              )}

            </>
          )}
        </div>
      </div>

      <div ref={messagesContainerRef} className="bg-white dark:bg-gray-900 rounded-lg p-5 mb-5 min-h-[400px] max-h-[600px] overflow-auto">
        {loading ? (
          <div className="text-gray-600 dark:text-gray-400">Loading messages...</div>
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
            {messages.map((msg, i) => {
              // Determine background and text colors based on sender type
              const getBubbleStyles = () => {
                const baseStyles = 'px-3.5 py-2.5 rounded-lg max-w-[70%]'
                const alignment = msg.sender === 'user' ? 'self-end' : 'self-start'

                switch (msg.sender) {
                  case 'user':
                    return `${baseStyles} ${alignment} bg-indigo-500 dark:bg-indigo-600 text-white`
                  case 'agent':
                    return `${baseStyles} ${alignment} bg-green-500 dark:bg-green-600 text-white`
                  case 'bot':
                    return `${baseStyles} ${alignment} bg-gray-600 dark:bg-gray-700 text-white`
                  case 'internal':
                    return `${baseStyles} ${alignment} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-2 border-dashed border-yellow-400 dark:border-yellow-600`
                  case 'system':
                    return `${baseStyles} ${alignment} bg-blue-50 dark:bg-gray-800 text-blue-900 dark:text-gray-100`
                  default:
                    return `${baseStyles} ${alignment} bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100`
                }
              }

              return (
                <div
                  key={i}
                  className={getBubbleStyles()}
                >
                  <div className="text-xs opacity-80 mb-1 font-medium text-current">
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
                        <div className="text-[13px] leading-relaxed break-words text-current">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words text-current">{msg.text}</div>
                  )}
                  <div className="text-[11px] opacity-70 mt-1 text-current">
                    {new Date(msg.timestamp).toLocaleString()}
                  </div>
                </div>
              )
            })}

            {/* Typing Indicator - Inside message list */}
            {remoteTypingUser && (
              <div className="flex items-center gap-2 p-4 text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span>{remoteTypingUser} is typing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Private Note Toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={isPrivateNote}
              onChange={(e) => setIsPrivateNote(e.target.checked)}
              className="w-4 h-4 cursor-pointer text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
            />
            <span>🔒 Private Note (only visible to agents)</span>
          </label>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            {/* Suggestions Menu */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-[200px] overflow-y-auto z-[1000] min-w-[300px]">
                {suggestions.map((resp, index) => (
                  <div
                    key={resp.$id}
                    onClick={() => selectCannedResponse(resp)}
                    className={`px-3 py-2.5 cursor-pointer transition-colors ${index === selectedSuggestionIndex
                      ? 'bg-blue-600 dark:bg-blue-900/50 text-white dark:text-gray-100'
                      : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                      } ${index < suggestions.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                      }`}
                    onMouseEnter={() => setSelectedSuggestionIndex(index)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">
                        /{resp.shortcut}
                      </span>
                      {resp.category && (
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded ${index === selectedSuggestionIndex
                            ? 'bg-white/20 dark:bg-white/10 text-white dark:text-gray-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                            }`}
                        >
                          {resp.category}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs ${index === selectedSuggestionIndex
                      ? 'text-white/90 dark:text-gray-200'
                      : 'text-gray-600 dark:text-gray-400'
                      } overflow-hidden text-ellipsis whitespace-nowrap`}>
                      {resp.content.length > 50 ? resp.content.substring(0, 50) + '...' : resp.content}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              placeholder="Type your message... (Use / for canned responses)"
              value={messageText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setMessageText(e.target.value)
                handleTypingInput() // Trigger typing indicator
              }}
              onKeyDown={handleKeyDown}
              disabled={!canSendMessages || isSending}
              spellCheck={true}
              rows={1}
              className="w-full px-2.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed resize-y min-h-[40px] max-h-[200px] text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
              onInput={(e) => {
                // Auto-resize textarea
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`
              }}
            />
          </div>
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

