import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSound } from '../../hooks/useSound'
import Toast from './Toast'

const SOCKET_URL = 'http://localhost:4000'

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
    playPop, 
    pauseRing, 
    pausePop, 
    isRingPlaying, 
    isPopPlaying, 
    audioEnabled, 
    setAudioEnabled 
  } = useSound({ enabled: true })
  const [socket, setSocket] = useState<Socket | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [ringPlaying, setRingPlaying] = useState(false)
  const [popPlaying, setPopPlaying] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  
  // Use refs to store the play functions to avoid infinite re-renders
  // This ensures the socket effect doesn't re-run when playRing/playPop change
  const playRingRef = useRef(playRing)
  const playPopRef = useRef(playPop)
  
  // Keep refs updated with latest functions
  useEffect(() => {
    playRingRef.current = playRing
    playPopRef.current = playPop
  }, [playRing, playPop])

  // Check playing state periodically for UI updates
  useEffect(() => {
    if (!audioEnabled) return

    const interval = setInterval(() => {
      setRingPlaying(isRingPlaying())
      setPopPlaying(isPopPlaying())
    }, 100) // Check every 100ms for smooth UI updates

    return () => clearInterval(interval)
  }, [audioEnabled, isRingPlaying, isPopPlaying])

  useEffect(() => {
    // Connect to socket for global notifications
    const sock = io(SOCKET_URL)
    
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
          message: 'New incoming chat!',
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
          message: `New message in assigned session ${sessionId.substring(0, 8)}...`,
          type: 'info'
        }])
      }
    })

    setSocket(sock)

    return () => {
      sock.off('session_started')
      sock.off('user_message_for_agent')
      sock.disconnect()
    }
  }, []) // Empty dependency array - socket should only be created once

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const handleTestRing = () => {
    if (ringPlaying) {
      // If playing, pause it
      pauseRing()
      const toastId = `test-ring-paused-${Date.now()}`
      setToasts(prev => [...prev, {
        id: toastId,
        message: '🔔 Ring sound paused',
        type: 'info'
      }])
    } else {
      // If paused or stopped, play it
      playRing()
      const toastId = `test-ring-${Date.now()}`
      setToasts(prev => [...prev, {
        id: toastId,
        message: '🔔 Test ring sound played',
        type: 'info'
      }])
    }
  }

  const handleTestPop = () => {
    if (popPlaying) {
      // If playing, pause it
      pausePop()
      const toastId = `test-pop-paused-${Date.now()}`
      setToasts(prev => [...prev, {
        id: toastId,
        message: '🔔 Pop sound paused',
        type: 'info'
      }])
    } else {
      // If paused or stopped, play it
      playPop()
      const toastId = `test-pop-${Date.now()}`
      setToasts(prev => [...prev, {
        id: toastId,
        message: '🔔 Test pop sound played',
        type: 'info'
      }])
    }
  }

  return (
    <>
      {/* Audio enable toggle */}
      {!audioEnabled && (
        <div className="fixed bottom-4 right-4 z-50 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-800">🔊 Enable audio notifications</span>
            <button
              onClick={() => setAudioEnabled(true)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {/* Audio controls (only show when audio is enabled) */}
      {audioEnabled && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden transition-all duration-300">
          <div className="flex items-center">
            {/* Toggle arrow button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2 py-3 bg-gray-100 hover:bg-gray-200 transition-colors border-r border-gray-300"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              <span className={`text-gray-600 text-sm transition-transform duration-300 ${isExpanded ? '' : 'rotate-180'}`}>
                ←
              </span>
            </button>
            
            {/* Content panel */}
            {isExpanded && (
              <div className="p-3">
                <div className="flex items-center gap-3">
                  {/* Audio status indicator */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-green-500 text-lg">🔊</span>
                      <span className="text-xs font-medium text-gray-700">Audio On</span>
                    </div>
                    <button
                      onClick={() => setAudioEnabled(false)}
                      className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                      title="Disable audio notifications"
                    >
                      Disable
                    </button>
                  </div>
                  
                  {/* Divider */}
                  <div className="w-px h-6 bg-gray-300"></div>
                  
                  {/* Test sound buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Test:</span>
                    <button
                      onClick={handleTestRing}
                      className={`px-2 py-1 text-white text-xs rounded flex items-center gap-1 ${
                        ringPlaying
                          ? 'bg-orange-500 hover:bg-orange-600'
                          : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                      title={ringPlaying ? "Pause ring sound" : "Play ring sound (new session)"}
                    >
                      {ringPlaying ? '⏸️' : '🔔'} Ring
                    </button>
                    <button
                      onClick={handleTestPop}
                      className={`px-2 py-1 text-white text-xs rounded flex items-center gap-1 ${
                        popPlaying
                          ? 'bg-orange-500 hover:bg-orange-600'
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                      title={popPlaying ? "Pause pop sound" : "Play pop sound (agent message)"}
                    >
                      {popPlaying ? '⏸️' : '🔊'} Pop
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast notifications - stack from top to bottom, newest at bottom */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 items-end">
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

