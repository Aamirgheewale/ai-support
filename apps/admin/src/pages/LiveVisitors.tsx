import React, { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'
import { Card, TableContainer, Table, Thead, Th, Tbody, Tr, Td } from '../components/ui'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000'

interface LiveVisitor {
  socketId: string
  url: string
  title: string
  referrer: string
  userAgent: string
  onlineAt: string
  status?: 'online' | 'chatting'
  sessionId?: string
}

export default function LiveVisitors() {
  const { user } = useAuth()
  const [visitors, setVisitors] = useState<LiveVisitor[]>([])
  const [socket, setSocket] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null)
  const [welcomeMessage, setWelcomeMessage] = useState('Hi! I noticed you are browsing... How can I help?')

  useEffect(() => {
    // Connect to socket
    const sock = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    })
    
    sock.on('connect', () => {
      console.log('✅ Socket connected for live visitors')
      // Join admin feed to receive live visitor updates
      sock.emit('join_admin_feed')
      console.log('👮 Joined admin_feed room')
    })
    
    // Listen for live visitor updates
    sock.on('live_visitors_update', (data: LiveVisitor[]) => {
      console.log('📊 Received live visitors update:', data.length, 'visitors')
      setVisitors(data)
    })
    
    sock.on('disconnect', () => {
      console.log('❌ Socket disconnected')
    })
    
    setSocket(sock)
    
    return () => {
      sock.off('connect')
      sock.off('live_visitors_update')
      sock.off('disconnect')
      sock.disconnect()
    }
  }, [])

  // Calculate time online (relative time from onlineAt)
  function getTimeOnline(onlineAt: string): string {
    const now = new Date()
    const online = new Date(onlineAt)
    const diffMs = now.getTime() - online.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffSecs < 60) {
      return `${diffSecs}s`
    } else if (diffMins < 60) {
      return `${diffMins}m`
    } else {
      return `${diffHours}h ${diffMins % 60}m`
    }
  }

  // Extract device/browser info from userAgent
  function getDeviceInfo(userAgent: string): string {
    if (!userAgent) return 'Unknown'
    
    // Simple device detection
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return 'Mobile'
    } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
      return 'Tablet'
    } else {
      return 'Desktop'
    }
  }

  function handleInitiateChat(visitor: LiveVisitor) {
    setSelectedVisitorId(visitor.socketId)
    setIsModalOpen(true)
    setWelcomeMessage('Hi! I noticed you are browsing... How can I help?')
  }
  
  function handleConfirmInitiateChat() {
    if (!selectedVisitorId || !socket || !welcomeMessage.trim()) {
      return
    }
    
    // Get agentId from currentUser.$id (user.userId from auth context)
    const agentId = user?.userId || 'admin'
    
    // Find visitor object to get socketId
    const visitor = visitors.find(v => v.socketId === selectedVisitorId)
    if (!visitor) {
      alert('Visitor not found')
      return
    }
    
    socket.emit('initiate_chat', {
      targetSocketId: visitor.socketId,
      message: welcomeMessage.trim(),
      agentId: agentId
    })
    
    console.log('📤 Emitted initiate_chat:', {
      targetSocketId: visitor.socketId,
      message: welcomeMessage.trim(),
      agentId: agentId
    })
    
    // Listen for chat_initiated response
    socket.once('chat_initiated', (data: any) => {
      if (data.success && data.sessionId) {
        console.log('✅ Chat initiated successfully:', data)
        // Optionally redirect to conversation view or show success message
        alert(`Chat initiated! Session ID: ${data.sessionId}\n\nYou can now continue the conversation in the Sessions page.`)
      } else {
        console.error('❌ Failed to initiate chat:', data)
        alert(`Failed to initiate chat: ${data.error || 'Unknown error'}`)
      }
    })
    
    socket.once('error', (error: any) => {
      console.error('❌ Error initiating chat:', error)
      alert(`Error: ${error.error || 'Failed to initiate chat'}`)
    })
    
    // Close modal and clear state
    setIsModalOpen(false)
    setSelectedVisitorId(null)
    setWelcomeMessage('Hi! I noticed you are browsing... How can I help?')
  }
  
  function handleCancelInitiateChat() {
    setIsModalOpen(false)
    setSelectedVisitorId(null)
    setWelcomeMessage('Hi! I noticed you are browsing... How can I help?')
  }

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Live Visitors
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Real-time tracking of visitors on your site 
        </p>
      </div>

      {visitors.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="text-5xl mb-4">👤</div>
          <div className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            No active visitors
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Visitors will appear here when they land on your site
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {visitors.length} active visitor{visitors.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400 inline-block animate-pulse"></span>
              Live
            </div>
          </div>
          
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Status</Th>
                  <Th>URL</Th>
                  <Th>Page Title</Th>
                  <Th>Device</Th>
                  <Th>Time Online</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {visitors.map((visitor) => (
                  <Tr key={visitor.socketId}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full inline-block ${
                          visitor.status === 'chatting' 
                            ? 'bg-blue-600 dark:bg-blue-400 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]' 
                            : 'bg-green-600 dark:bg-green-400 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]'
                        }`}></span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {visitor.status === 'chatting' ? 'Chatting' : 'Online'}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <a
                        href={visitor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm max-w-[400px] block truncate"
                      >
                        {visitor.url}
                      </a>
                    </Td>
                    <Td>
                      <div className="text-sm max-w-[300px] truncate">
                        {visitor.title || '(No title)'}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-sm">
                        {getDeviceInfo(visitor.userAgent)}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-sm">
                        {getTimeOnline(visitor.onlineAt)}
                      </div>
                    </Td>
                    <Td>
                      <button
                        onClick={() => handleInitiateChat(visitor)}
                        className="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-md text-xs font-medium cursor-pointer transition-colors"
                      >
                        Initiate Chat
                      </button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Card>
      )}
      
      {/* Initiate Chat Modal */}
      {isModalOpen && selectedVisitorId && (() => {
        const selectedVisitor = visitors.find(v => v.socketId === selectedVisitorId)
        return selectedVisitor ? (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-[1000]"
          onClick={handleCancelInitiateChat}
        >
          <Card 
            className="p-6 max-w-lg w-[90%]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Initiate Chat
            </h2>
            
            <div className="mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Visitor: <strong className="text-gray-900 dark:text-white">{selectedVisitor.url}</strong>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {selectedVisitor.title || '(No title)'}
              </div>
            </div>
            
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Welcome Message:
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Enter your welcome message..."
                className="w-full min-h-[100px] p-3 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-inherit resize-y outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelInitiateChat}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-none rounded-md text-sm font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmInitiateChat}
                disabled={!welcomeMessage.trim()}
                className={`px-4 py-2 border-none rounded-md text-sm font-medium transition-colors ${
                  welcomeMessage.trim()
                    ? 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white cursor-pointer'
                    : 'bg-gray-300 dark:bg-gray-600 text-white cursor-not-allowed'
                }`}
              >
                Send
              </button>
            </div>
          </Card>
        </div>
        ) : null
      })()}
    </div>
  )
}

