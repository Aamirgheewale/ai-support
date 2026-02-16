import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSoundContext } from '../../context/SoundContext'
import Toast from './Toast'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000'

interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

/**
 * AudioNotifications - Channel A: Toast Only (Temporary)
 * 
 * Channel A Rules:
 * - Show Toast + Sound
 * - Do NOT save to DB/Context
 * 
 * Events:
 * - user_message_for_agent (Sound: Pop)
 * - session_started (Sound: Ring)
 */
export default function AudioNotifications() {
  const {
    playRing,
    playPop,
    stopRing
  } = useSoundContext()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Use refs to store the play functions to avoid infinite re-renders
  const playRingRef = useRef(playRing)
  const playPopRef = useRef(playPop)

  // Keep refs updated with latest functions
  useEffect(() => {
    playRingRef.current = playRing
    playPopRef.current = playPop
  }, [playRing, playPop])

  useEffect(() => {
    // Connect to socket for global notifications
    const sock = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    })

    // Track ringing sessions and safety timeout
    const ringingSessions = new Set<string>()
    let ringTimeoutId: ReturnType<typeof setTimeout> | null = null

    sock.on('connect', () => {
      console.log('🔊 Audio notifications socket connected, socket.id:', sock.id)
      // Join admin_feed to receive global updates
      sock.emit('join_admin_feed')
      console.log('📤 Emitted join_admin_feed')
    })

    sock.on('error', (error: any) => {
      console.error('❌ Socket error:', error)
    })

    sock.on('disconnect', () => {
      console.log('🔌 Audio notifications socket disconnected')
      // Stop ringing on disconnect
      if (ringingSessions.size > 0) {
        stopRing()
        ringingSessions.clear()
        if (ringTimeoutId) {
          clearTimeout(ringTimeoutId)
          ringTimeoutId = null
        }
      }
    })

    // ============================================
    // CHANNEL A: Toast + Sound
    // ============================================

    // 1. session_started - Toast only (NO ring sound)
    sock.on('session_started', (data: any) => {
      console.log('🔔 [CHANNEL A] session_started:', data)
      const { sessionId } = data || {}
      if (sessionId) {
        // Toast notification only (ring removed)
        const toastId = `session-${sessionId}-${Date.now()}`
        setToasts(prev => [...prev, {
          id: toastId,
          message: `New chat session: ${sessionId}`,
          type: 'info'
        }])
      }
    })

    // 2. new_notification - Ring sound for agent requests
    sock.on('new_notification', (data: any) => {
      console.log('🔔 [CHANNEL A] new_notification:', data)
      const { type, sessionId, content } = data || {}

      // Only ring for agent requests
      if (type === 'request_agent' && sessionId) {
        console.log('🔊 Agent requested - starting ring loop...')

        // Add to ringing sessions
        ringingSessions.add(sessionId)

        // Start ringing
        try {
          const playPromise = playRingRef.current()
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch((err: any) => {
              console.error('❌ Failed to play ring sound:', err)
              console.warn('💡 Audio may be blocked by browser autoplay policy. User interaction required.')
            })
          }
        } catch (err) {
          console.error('❌ Error calling playRing:', err)
        }

        // Safety timeout: stop ringing after 30 seconds
        if (ringTimeoutId) clearTimeout(ringTimeoutId)
        ringTimeoutId = setTimeout(() => {
          console.log('⏰ Ring safety timeout reached (30s) - stopping ring')
          stopRing()
          ringingSessions.clear()
          ringTimeoutId = null
        }, 30000)

        // Toast notification
        const toastId = `agent-request-${sessionId}-${Date.now()}`
        setToasts(prev => [...prev, {
          id: toastId,
          message: `Agent requested in session: ${sessionId}`,
          type: 'info'
        }])
      }
    })

    // 3. agent_joined - Stop ringing when agent joins
    sock.on('agent_joined', (data: any) => {
      console.log('🔔 [CHANNEL A] agent_joined:', data)
      const { sessionId, agentId, agentName } = data || {}

      if (sessionId && ringingSessions.has(sessionId)) {
        console.log(`✅ Agent ${agentName || agentId} joined session ${sessionId} - stopping ring`)

        // Remove from ringing sessions
        ringingSessions.delete(sessionId)

        // Stop ring if no more ringing sessions
        if (ringingSessions.size === 0) {
          stopRing()
          if (ringTimeoutId) {
            clearTimeout(ringTimeoutId)
            ringTimeoutId = null
          }
        }
      }
    })

    // 4. session_updated - Stop ringing if session is assigned
    sock.on('session_updated', (data: any) => {
      console.log('🔔 [CHANNEL A] session_updated:', data)
      const { sessionId, assignedAgent } = data || {}

      if (sessionId && assignedAgent && ringingSessions.has(sessionId)) {
        console.log(`✅ Session ${sessionId} assigned to ${assignedAgent} - stopping ring`)

        // Remove from ringing sessions
        ringingSessions.delete(sessionId)

        // Stop ring if no more ringing sessions
        if (ringingSessions.size === 0) {
          stopRing()
          if (ringTimeoutId) {
            clearTimeout(ringTimeoutId)
            ringTimeoutId = null
          }
        }
      }
    })

    // 5. user_message_for_agent - Pop sound + Toast
    sock.on('user_message_for_agent', (data: any) => {
      const { sessionId, text } = data || {}
      if (sessionId) {
        console.log('🔔 [CHANNEL A] user_message_for_agent:', sessionId)
        playPopRef.current()

        const toastId = `agent-message-${sessionId}-${Date.now()}`
        setToasts(prev => [...prev, {
          id: toastId,
          message: `New message in session: ${sessionId}`,
          type: 'info'
        }])
      }
    })

    setSocket(sock)

    return () => {
      console.log('🔌 Cleaning up AudioNotifications socket listeners')

      // Stop ringing on cleanup
      if (ringingSessions.size > 0) {
        stopRing()
        ringingSessions.clear()
      }
      if (ringTimeoutId) {
        clearTimeout(ringTimeoutId)
      }

      sock.off('connect')
      sock.off('error')
      sock.off('disconnect')
      sock.off('session_started')
      sock.off('new_notification')
      sock.off('agent_joined')
      sock.off('session_updated')
      sock.off('user_message_for_agent')
      sock.disconnect()
    }
  }, []) // Empty dependency array - socket should only be created once

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <>
      {/* Toast notifications - stack from top to bottom, newest at bottom */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
            duration={5000}
          />
        ))}
      </div>
    </>
  )
}
