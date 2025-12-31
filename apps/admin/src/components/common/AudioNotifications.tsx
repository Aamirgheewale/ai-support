import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSound } from '../../hooks/useSound'
import Toast from './Toast'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000'

interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

/**
 * Global audio notifications component for admin dashboard
 * Listens for new sessions and user messages to play sounds
 */
export default function AudioNotifications() {
  const { 
    playRing, 
    playPop
  } = useSound({ enabled: true })
  const [socket, setSocket] = useState<Socket | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  
  // Use refs to store the play functions to avoid infinite re-renders
  // This ensures the socket effect doesn't re-run when playRing/playPop change
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
    
    // IMPORTANT: Set up listeners BEFORE connect to ensure they're ready
    // Listen for new session start (ring sound)
    sock.on('session_started', (data: any) => {
      console.log('🔔 [AUDIO] Received session_started event:', data)
      const { sessionId } = data || {}
      if (sessionId) {
        console.log('🔔 New session started:', sessionId)
        playRingRef.current()
        
        // Show toast notification
        const toastId = `session-${sessionId}-${Date.now()}`
        setToasts(prev => [...prev, {
          id: toastId,
          message: `New incoming chat! Session: ${sessionId}`,
          type: 'info'
        }])
      } else {
        console.warn('⚠️ [AUDIO] session_started event missing sessionId:', data)
      }
    })
    
    sock.on('connect', () => {
      console.log('🔊 Audio notifications socket connected, socket.id:', sock.id)
      // Join admin feed to receive global updates
      sock.emit('join_admin_feed')
      console.log('📤 Emitted join_admin_feed')
      
      // Verify we're listening for session_started
      console.log('👂 Listening for session_started events')
    })
    
    // Also listen for any errors
    sock.on('error', (error: any) => {
      console.error('❌ Socket error:', error)
    })
    
    sock.on('disconnect', () => {
      console.log('🔌 Audio notifications socket disconnected')
    })

    // Listen for user_message_for_agent (specific to assigned agent)
    sock.on('user_message_for_agent', (data: any) => {
      const { sessionId, text } = data || {}
      if (sessionId) {
        console.log('🔔 User message for agent:', sessionId)
        playPopRef.current()
        
        // Show toast notification
        const toastId = `agent-message-${sessionId}-${Date.now()}`
        setToasts(prev => [...prev, {
          id: toastId,
          message: `New message in session: ${sessionId}`,
          type: 'info'
        }])
      }
    })
    
    // Listen for admin_ring_sound event (when user requests agent or clicks "Ask something else")
    sock.on('admin_ring_sound', (data: any) => {
      const { sessionId, reason } = data || {}
      console.log('🔔 [AUDIO] Received admin_ring_sound event:', data)
      if (sessionId) {
        console.log('🔔 Ring notification triggered:', sessionId, reason)
        playRingRef.current()
        
        // Show toast notification
        const toastId = `ring-${sessionId}-${Date.now()}`
        setToasts(prev => [...prev, {
          id: toastId,
          message: `🔔 User requested agent assistance! Session: ${sessionId}`,
          type: 'info'
        }])
      } else {
        console.warn('⚠️ [AUDIO] admin_ring_sound event missing sessionId:', data)
      }
    })

    setSocket(sock)

    return () => {
      sock.off('session_started')
      sock.off('user_message_for_agent')
      sock.off('admin_ring_sound')
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

