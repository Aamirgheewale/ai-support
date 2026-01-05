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
    playPop
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
    
    sock.on('connect', () => {
      console.log('🔊 Audio notifications socket connected, socket.id:', sock.id)
      // Join admin feed to receive global updates
      sock.emit('join_admin_feed')
      console.log('📤 Emitted join_admin_feed')
    })
    
    sock.on('error', (error: any) => {
      console.error('❌ Socket error:', error)
    })
    
    sock.on('disconnect', () => {
      console.log('🔌 Audio notifications socket disconnected')
    })

    // ============================================
    // CHANNEL A: Toast Only (Temporary)
    // ============================================

    // 1. session_started - Ring sound + Toast
    sock.on('session_started', (data: any) => {
      console.log('🔔 [CHANNEL A] session_started:', data)
      const { sessionId } = data || {}
      if (sessionId) {
        // Attempt to play ring sound with error handling
        try {
          console.log('🔊 Attempting to play ring sound...')
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
        
        const toastId = `session-${sessionId}-${Date.now()}`
        setToasts(prev => [...prev, {
          id: toastId,
          message: `New incoming chat! Session: ${sessionId}`,
          type: 'info'
        }])
      }
    })

    // 2. user_message_for_agent - Pop sound + Toast
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
      sock.off('connect')
      sock.off('error')
      sock.off('disconnect')
      sock.off('session_started')
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
