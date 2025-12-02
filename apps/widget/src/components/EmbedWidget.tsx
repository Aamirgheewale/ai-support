import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

export default function EmbedWidget({ initialSessionId }: { initialSessionId?: string }) {
  // Load sessionId from localStorage or use initialSessionId
  // BUT: Don't load if conversation was concluded
  const getStoredSessionId = () => {
    if (initialSessionId) return initialSessionId;
    const stored = localStorage.getItem('ai-support-session-id');
    if (stored) {
      // Check if this session was concluded - if so, don't restore it
      const concluded = localStorage.getItem(`ai-support-concluded-${stored}`);
      if (concluded === 'true') {
        // Session was concluded, clear it and return null
        localStorage.removeItem('ai-support-session-id');
        localStorage.removeItem(`ai-support-messages-${stored}`);
        localStorage.removeItem(`ai-support-concluded-${stored}`);
        console.log('🧹 Cleared concluded session from localStorage on mount');
        return null;
      }
      return stored;
    }
    return null;
  };

  const [sessionId, setSessionId] = useState<string | null>(getStoredSessionId());
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; ts?: number; type?: string; options?: Array<{ text: string; value: string }> }>>([]);
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isButtonBlinking, setIsButtonBlinking] = useState(false);
  const [conversationConcluded, setConversationConcluded] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const messagesLoadedRef = useRef(false); // Track if messages have been loaded

  // Apply theme from CSS variables
  function applyTheme(themeVars: Record<string, string>) {
    const root = document.documentElement;
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(`--ai-support-${key}`, value);
    });
  }

  // Load messages and conversation state from localStorage when widget reopens
  const loadMessagesFromStorage = (sid: string) => {
    if (messagesLoadedRef.current) return; // Already loaded
    try {
      // First check if conversation was concluded - if so, don't load anything
      const storedConcluded = localStorage.getItem(`ai-support-concluded-${sid}`);
      if (storedConcluded === 'true') {
        // Session was concluded, clear it and don't load messages
        localStorage.removeItem('ai-support-session-id');
        localStorage.removeItem(`ai-support-messages-${sid}`);
        localStorage.removeItem(`ai-support-concluded-${sid}`);
        console.log(`🧹 Session ${sid} was concluded - cleared localStorage and skipping message load`);
        return;
      }
      
      const storedMessages = localStorage.getItem(`ai-support-messages-${sid}`);
      
      if (storedMessages) {
        const loadedMessages = JSON.parse(storedMessages);
        setMessages(loadedMessages);
        messagesLoadedRef.current = true;
        console.log(`📥 Loaded ${loadedMessages.length} message(s) from localStorage for session ${sid}`);
      }
    } catch (err) {
      console.warn('Failed to load messages from localStorage:', err);
    }
  };

  // Save messages and conversation state to localStorage whenever they change
  useEffect(() => {
    if (sessionId) {
      try {
        if (messages.length > 0) {
          localStorage.setItem(`ai-support-messages-${sessionId}`, JSON.stringify(messages));
        }
        localStorage.setItem(`ai-support-concluded-${sessionId}`, String(conversationConcluded));
      } catch (err) {
        console.warn('Failed to save to localStorage:', err);
      }
    }
  }, [messages, sessionId, conversationConcluded]);

  // Load messages when sessionId exists (widget reopened) - run on mount and when sessionId changes
  useEffect(() => {
    if (sessionId && !messagesLoadedRef.current) {
      loadMessagesFromStorage(sessionId);
    }
  }, [sessionId]);

  // Also load messages on initial mount if sessionId exists
  useEffect(() => {
    const storedSessionId = getStoredSessionId();
    if (storedSessionId && !messagesLoadedRef.current) {
      loadMessagesFromStorage(storedSessionId);
    }
    // Check socket connection status on mount
    if (socket.connected) {
      setIsConnected(true);
    }
  }, []); // Run only on mount

  // Fetch theme on session start
  useEffect(() => {
    if (sessionId) {
      fetch(`http://localhost:4000/session/${sessionId}/theme`)
        .then(res => res.json())
        .then(data => {
          if (data.theme && Object.keys(data.theme).length > 0) {
            applyTheme(data.theme);
          }
        })
        .catch(err => console.warn('Failed to load theme:', err));
    }
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const startTypingIndicator = () => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    setIsBotTyping(true);
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsBotTyping(false);
      typingTimeoutRef.current = null;
    }, 20000); // auto-hide after 20s to avoid stuck indicator
  };

  const stopTypingIndicator = () => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setIsBotTyping(false);
  };

  useEffect(() => {
    // Check if socket is already connected when component mounts
    if (socket.connected) {
      setIsConnected(true);
      console.log('ws already connected', socket.id);
      // Join session room if sessionId exists
      if (sessionId) {
        socket.emit('join_session', { sessionId });
        console.log(`📱 Widget socket joined session room (already connected): ${sessionId}`);
      }
    }

    socket.on('connect', () => {
      console.log('ws connected', socket.id);
      setIsConnected(true);
      // CRITICAL: Join session room if sessionId exists to receive agent messages
      if (sessionId) {
        socket.emit('join_session', { sessionId });
        console.log(`📱 Widget socket joined session room: ${sessionId}`);
        // Load messages from storage when reconnecting
        if (!messagesLoadedRef.current) {
          loadMessagesFromStorage(sessionId);
        }
      }
    });
    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('ws disconnected');
    });
    socket.on('reconnect', () => {
      console.log('ws reconnected', socket.id);
      setIsConnected(true);
      // Rejoin session room on reconnect
      if (sessionId) {
        socket.emit('join_session', { sessionId });
        console.log(`📱 Widget socket rejoined session room on reconnect: ${sessionId}`);
      }
    });
    socket.on('session_started', ({ sessionId: newSessionId }) => {
      setSessionId(newSessionId);
      // Store sessionId in localStorage for persistence
      if (newSessionId) {
        localStorage.setItem('ai-support-session-id', newSessionId);
        messagesLoadedRef.current = false; // Reset flag to allow loading messages
        socket.emit('join_session', { sessionId: newSessionId });
        console.log(`📱 Widget socket joined session room on start: ${newSessionId}`);
      }
    });
    socket.on('bot_stream', (m: any) => {
      // Live partial text from backend streaming
      // We treat this as a temporary bot bubble until the final bot_message arrives
      if (!m || typeof m.text !== 'string') return;
      stopTypingIndicator();
      console.log('📨 Widget received bot_stream:', m);
      
      // Update streaming text - it will be hidden automatically if a matching bot_message exists
      setStreamingText(m.text);
    });
    socket.on('bot_message', (m: any) => {
      stopTypingIndicator();
      console.log('📨 Widget received bot_message:', m);

      // Clear any in-progress streaming text immediately when final message arrives
      setStreamingText(null);

      setMessages(prev => {
        // Check for duplicates more thoroughly - check both exact text match and recent messages
        const exists = prev.some(msg => 
          msg.sender === 'bot' && 
          msg.text === m.text &&
          // Also check if it's a very recent duplicate (within last 2 seconds)
          (msg.ts && Date.now() - msg.ts < 2000)
        );
        if (exists) {
          console.log('   ⚠️  Duplicate bot message detected, skipping');
          return prev;
        }
        return [...prev, { 
          sender: 'bot', 
          text: m.text, 
          ts: Date.now(),
          type: m.type,
          options: m.options
        }];
      });
      
      // Check if conversation is concluded
      if (m.type === 'conclusion_final') {
        setConversationConcluded(true);
        // Clear ALL localStorage when conversation is concluded
        if (sessionId) {
          localStorage.removeItem('ai-support-session-id');
          localStorage.removeItem(`ai-support-messages-${sessionId}`);
          localStorage.removeItem(`ai-support-concluded-${sessionId}`);
          console.log('🧹 Cleared localStorage - conversation concluded (conclusion_final received)');
        }
      }
    });
    socket.on('agent_message', (m: any) => {
      stopTypingIndicator();
      console.log('📨 Widget received agent_message:', m);
      setMessages(prev => {
        const exists = prev.some(msg => msg.sender === 'agent' && msg.text === m.text);
        if (exists) {
          console.log('   ⚠️  Duplicate agent message, skipping');
          return prev;
        }
        console.log('   ✅ Adding agent message to widget');
        return [...prev, { sender: 'agent', text: m.text, ts: Date.now() }];
      });
    });
    socket.on('agent_joined', (data: any) => {
      console.log('📨 Widget received agent_joined:', data);
      // Ensure we're in the session room when agent joins
      if (sessionId) {
        socket.emit('join_session', { sessionId });
        console.log(`📱 Widget socket rejoined session room on agent join: ${sessionId}`);
      }
      setMessages(prev => [...prev, { sender: 'system', text: `Agent ${data.agentId} joined the conversation`, ts: Date.now() }]);
    });
    socket.on('session_error', (err: any) => {
      stopTypingIndicator();
      setMessages(prev => [...prev, { sender: 'system', text: `Error: ${err.error}`, ts: Date.now() }]);
    });
    socket.on('conversation_closed', (data: any) => {
      const { sessionId: closedSessionId } = data || {};
      // Only reset if this is the current session
      if (closedSessionId === sessionId) {
        console.log('🔒 Conversation closed by agent - resetting chat widget');
        setConversationConcluded(true);
        // Clear ALL localStorage when agent closes conversation
        if (sessionId) {
          localStorage.removeItem('ai-support-session-id');
          localStorage.removeItem(`ai-support-messages-${sessionId}`);
          localStorage.removeItem(`ai-support-concluded-${sessionId}`);
          console.log('🧹 Cleared localStorage - conversation closed by agent');
        }
        // Clear messages and reset state, then show notification
        setStreamingText(null);
        messagesLoadedRef.current = false;
        // Show notification message to user
        setMessages([{ sender: 'system', text: 'Conversation closed by agent. Please start a new chat.', ts: Date.now() }]);
      }
    });
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect');
      socket.off('session_started');
      socket.off('bot_message');
      socket.off('bot_stream');
      socket.off('agent_message');
      socket.off('agent_joined');
      socket.off('session_error');
      socket.off('conversation_closed');
    };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function start() {
    const sid = sessionId || `s_${Date.now()}`;
    setSessionId(sid);
    // Store sessionId in localStorage
    localStorage.setItem('ai-support-session-id', sid);
    // Clear old messages and storage for new session
    setMessages([]);
    localStorage.removeItem(`ai-support-messages-${sid}`); // Clear old messages
    localStorage.removeItem(`ai-support-concluded-${sid}`); // Clear concluded state
    setStreamingText(null);
    setConversationConcluded(false);
    messagesLoadedRef.current = false; // Reset loaded flag for new session
    socket.emit('start_session', { sessionId: sid, userMeta: {} });
    // Trigger blinking animation
    setIsButtonBlinking(true);
    setTimeout(() => setIsButtonBlinking(false), 2000); // Stop after 2 seconds
  }
  
  function handleConclusionOption(optionValue: string, optionText: string) {
    if (!sessionId || conversationConcluded) return; // Don't allow clicks if conversation is concluded
    
    // Send the selected option as a user message
    setMessages(prev => [...prev, { sender: 'user', text: optionText, ts: Date.now() }]);
    socket.emit('user_message', { sessionId, text: optionText });
    
    if (optionValue === 'thank_you') {
      // Option 1: Thank you - conversation is ending, clear localStorage immediately
      startTypingIndicator();
      // Clear all localStorage data when user chooses to end conversation
      if (sessionId) {
        localStorage.removeItem('ai-support-session-id');
        localStorage.removeItem(`ai-support-messages-${sessionId}`);
        localStorage.removeItem(`ai-support-concluded-${sessionId}`);
        console.log('🧹 Cleared localStorage - conversation ended by user choice');
      }
    } else if (optionValue === 'continue') {
      // Option 2: Continue conversation - normal flow
      startTypingIndicator();
    }
  }

  function send() {
    if (!text.trim() || !sessionId) return;
    setMessages(prev => [...prev, { sender: 'user', text: text.trim(), ts: Date.now() }]);
    socket.emit('user_message', { sessionId, text: text.trim() });
    setText('');
    setStreamingText(null);
    startTypingIndicator();
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{ 
      width: 380, 
      height: 600,
      border: '1px solid rgba(255, 255, 255, 0.2)', 
      borderRadius: 12, 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      background: 'transparent',
      pointerEvents: 'auto'
    }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(to bottom right, #000000, #ffffff)',
        color: 'white',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>AI Customer Support</div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isConnected ? (
              <>
                <span className="online-indicator" style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#4CAF50',
                  display: 'inline-block'
                }}></span>
                <span>Online</span>
              </>
            ) : (
              <>
                <span style={{ color: '#999' }}>○</span>
                <span>Offline</span>
              </>
            )}
          </div>
        </div>
        {(!sessionId || conversationConcluded) && (
          <button 
            onClick={start}
            className={isButtonBlinking ? 'start-button-blink' : ''}
            style={{
              background: 'linear-gradient(to top left, #000000, #ffffff)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              padding: '6px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px',
              transition: 'all 0.3s ease'
            }}
          >
            {conversationConcluded ? 'Start New Chat' : 'Start Chat'}
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div style={{ 
        flex: 1,
        overflow: 'auto', 
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(56px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        isolation: 'isolate'
      }}>
        {messages.length === 0 && sessionId && (
          <div style={{ 
            textAlign: 'center', 
            color: '#ffffff', 
            fontSize: '14px',
            padding: '20px'
          }}>
            Type your message below to get started...
          </div>
        )}
        {messages.map((m, i) => (
          <div 
            key={i} 
            style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '4px'
            }}
          >
            <div style={{
              maxWidth: '75%',
              padding: '10px 14px',
              borderRadius: '12px',
              background: m.sender === 'user' 
                ? '#ffffff'
                : m.sender === 'system'
                ? '#000000'
                : '#ffffff',
              color: m.sender === 'system' ? '#ffffff' : (m.sender === 'user' ? '#000000' : '#000000'),
              fontSize: '14px',
              lineHeight: '1.5',
              boxShadow: m.sender !== 'system' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              border: m.sender === 'system' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none'
            }}>
              {m.text}
            </div>
            {m.type === 'conclusion_question' && m.options && !conversationConcluded && (
              <div style={{
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '75%'
              }}>
                {m.options.map((option, optIdx) => (
                  <button
                    key={optIdx}
                    onClick={() => handleConclusionOption(option.value, option.text)}
                    disabled={conversationConcluded}
                    style={{
                      padding: '10px 16px',
                      background: conversationConcluded 
                        ? 'rgba(200, 200, 200, 0.1)' 
                        : 'rgba(102, 126, 234, 0.1)',
                      border: conversationConcluded 
                        ? '1px solid rgba(200, 200, 200, 0.3)' 
                        : '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '14px',
                      cursor: conversationConcluded ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      opacity: conversationConcluded ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!conversationConcluded) {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!conversationConcluded) {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                      }
                    }}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {streamingText && !messages.some(msg => msg.sender === 'bot' && msg.text === streamingText) && (
          <div 
            style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              marginBottom: '4px'
            }}
          >
            <div style={{
              maxWidth: '75%',
              padding: '10px 14px',
              borderRadius: '12px',
              background: '#000000',
              color: '#ffffff',
              fontSize: '14px',
              lineHeight: '1.5',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              {streamingText}
            </div>
          </div>
        )}
        {isBotTyping && (
          <div 
            style={{ 
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '4px'
            }}
          >
            <div className="typing-bubble" aria-live="polite" aria-label="AI is typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ 
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(56px)',
        WebkitBackdropFilter: 'blur(56px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        gap: '8px'
      }}>
        <input 
          value={text} 
          onChange={e => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={!sessionId || conversationConcluded}
          style={{ 
            flex: 1, 
            padding: '10px 14px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            background: (sessionId && !conversationConcluded) ? 'white' : '#f5f5f5'
          }} 
          placeholder={
            conversationConcluded 
              ? "Conversation ended. Click 'Start Chat' for a new session" 
              : sessionId 
              ? "Type your message..." 
              : "Click 'Start Chat' to begin"
          } 
        />
        <button 
          onClick={send}
          disabled={!sessionId || !text.trim() || conversationConcluded}
          style={{
            padding: '10px 20px',
            background: (sessionId && text.trim() && !conversationConcluded)
              ? 'linear-gradient(135deg, #000000 0%, #ffffff 100%)'
              : '#ccc',
            color: (sessionId && text.trim() && !conversationConcluded) ? '#ffffff' : '#666',
            textShadow: (sessionId && text.trim() && !conversationConcluded) ? '0 1px 2px rgba(0, 0, 0, 0.5)' : 'none',
            border: 'none',
            borderRadius: '8px',
            cursor: (sessionId && text.trim() && !conversationConcluded) ? 'pointer' : 'not-allowed',
            fontWeight: 500,
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
