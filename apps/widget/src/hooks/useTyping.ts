import { useState, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'

interface TypingUser {
  name: string
  role: string
}

interface UseTypingOptions {
  socket: Socket | null
  sessionId: string | null
  currentUser: TypingUser
}

export function useTyping({ socket, sessionId, currentUser }: UseTypingOptions) {
  const [isTyping, setIsTyping] = useState(false)
  const [remoteTypingUser, setRemoteTypingUser] = useState<string | null>(null)
  const typingTimeoutRef = useRef<number | null>(null)

  // Listen for typing indicators from other users
  useEffect(() => {
    if (!socket || !sessionId) return

    const handleDisplayTyping = (data: { user: TypingUser; isTyping: boolean }) => {
      // Don't show typing indicator for current user
      if (data.user.name === currentUser.name && data.user.role === currentUser.role) {
        return
      }

      if (data.isTyping) {
        // Show typing indicator with user name or role
        const displayName = data.user.name || (data.user.role === 'agent' ? 'Agent' : 'Visitor')
        setRemoteTypingUser(displayName)
      } else {
        setRemoteTypingUser(null)
      }
    }

    socket.on('display_typing', handleDisplayTyping)

    return () => {
      socket.off('display_typing', handleDisplayTyping)
    }
  }, [socket, sessionId, currentUser])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  // Handle input change - emit typing_start/typing_stop with debounce
  const handleInput = () => {
    if (!socket || !sessionId) return

    // If not currently typing, emit typing_start
    if (!isTyping) {
      socket.emit('typing_start', {
        sessionId,
        user: currentUser
      })
      setIsTyping(true)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to emit typing_stop after 2000ms
    typingTimeoutRef.current = window.setTimeout(() => {
      if (socket && sessionId) {
        socket.emit('typing_stop', {
          sessionId,
          user: currentUser
        })
      }
      setIsTyping(false)
      typingTimeoutRef.current = null
    }, 2000)
  }

  return {
    remoteTypingUser,
    handleInput
  }
}
