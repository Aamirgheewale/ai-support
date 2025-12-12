import React, { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'

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
    const sock = io(SOCKET_URL)
    
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
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
          Live Visitors
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Real-time tracking of visitors on your site (Tawk.to-style dashboard)
        </p>
      </div>

      {visitors.length === 0 ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            No active visitors
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            Visitors will appear here when they land on your site
          </div>
        </div>
      ) : (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              {visitors.length} active visitor{visitors.length !== 1 ? 's' : ''}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#10b981'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                display: 'inline-block',
                animation: 'pulse 2s infinite'
              }}></span>
              Live
            </div>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Status
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    URL
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Page Title
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Device
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Time Online
                  </th>
                  <th style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((visitor, index) => (
                  <tr
                    key={visitor.socketId}
                    style={{
                      borderBottom: index < visitors.length - 1 ? '1px solid #e5e7eb' : 'none',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f9fafb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white'
                    }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: visitor.status === 'chatting' ? '#3b82f6' : '#10b981',
                          display: 'inline-block',
                          boxShadow: `0 0 0 2px ${visitor.status === 'chatting' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                        }}></span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {visitor.status === 'chatting' ? 'Chatting' : 'Online'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <a
                        href={visitor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#3b82f6',
                          textDecoration: 'none',
                          fontSize: '14px',
                          maxWidth: '400px',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none'
                        }}
                      >
                        {visitor.url}
                      </a>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{
                        fontSize: '14px',
                        color: '#374151',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {visitor.title || '(No title)'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{
                        fontSize: '14px',
                        color: '#374151'
                      }}>
                        {getDeviceInfo(visitor.userAgent)}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{
                        fontSize: '14px',
                        color: '#374151'
                      }}>
                        {getTimeOnline(visitor.onlineAt)}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <button
                        onClick={() => handleInitiateChat(visitor)}
                        style={{
                          padding: '6px 12px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#2563eb'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#3b82f6'
                        }}
                      >
                        Initiate Chat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Initiate Chat Modal */}
      {isModalOpen && selectedVisitorId && (() => {
        const selectedVisitor = visitors.find(v => v.socketId === selectedVisitorId)
        return selectedVisitor ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={handleCancelInitiateChat}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '16px'
            }}>
              Initiate Chat
            </h2>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '8px'
              }}>
                Visitor: <strong>{selectedVisitor.url}</strong>
              </div>
              <div style={{
                fontSize: '12px',
                color: '#9ca3af'
              }}>
                {selectedVisitor.title || '(No title)'}
              </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Welcome Message:
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Enter your welcome message..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db'
                }}
              />
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handleCancelInitiateChat}
                style={{
                  padding: '8px 16px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e7eb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmInitiateChat}
                disabled={!welcomeMessage.trim()}
                style={{
                  padding: '8px 16px',
                  background: welcomeMessage.trim() ? '#3b82f6' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: welcomeMessage.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (welcomeMessage.trim()) {
                    e.currentTarget.style.background = '#2563eb'
                  }
                }}
                onMouseLeave={(e) => {
                  if (welcomeMessage.trim()) {
                    e.currentTarget.style.background = '#3b82f6'
                  }
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
        ) : null
      })()}
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}

