import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

export default function EmbedWidget({ initialSessionId }: { initialSessionId?: string }) {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; ts?: number; type?: string; options?: Array<{ text: string; value: string }> }>>([]);
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isButtonBlinking, setIsButtonBlinking] = useState(false);
  const [conversationConcluded, setConversationConcluded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Apply theme from CSS variables
  function applyTheme(themeVars: Record<string, string>) {
    const root = document.documentElement;
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(`--ai-support-${key}`, value);
    });
  }

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
    socket.on('connect', () => {
      console.log('ws connected', socket.id);
      setIsConnected(true);
      // CRITICAL: Join session room if sessionId exists to receive agent messages
      if (sessionId) {
        socket.emit('join_session', { sessionId });
        console.log(`📱 Widget socket joined session room: ${sessionId}`);
      }
    });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('session_started', ({ sessionId: newSessionId }) => {
      setSessionId(newSessionId);
      // CRITICAL: Join session room when session starts
      if (newSessionId) {
        socket.emit('join_session', { sessionId: newSessionId });
        console.log(`📱 Widget socket joined session room on start: ${newSessionId}`);
      }
    });
    socket.on('bot_message', (m: any) => {
      stopTypingIndicator();
      console.log('📨 Widget received bot_message:', m);
      setMessages(prev => {
        const exists = prev.some(msg => msg.sender === 'bot' && msg.text === m.text);
        if (exists) return prev;
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
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('session_started');
      socket.off('bot_message');
      socket.off('agent_message');
      socket.off('agent_joined');
      socket.off('session_error');
    };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function start() {
    const sid = sessionId || `s_${Date.now()}`;
    setSessionId(sid);
    setMessages([]);
    setConversationConcluded(false);
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
      // Option 1: Thank you - wait for final message from backend
      startTypingIndicator();
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
      border: '1px solid #e0e0e0', 
      borderRadius: 12, 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      background: '#ffffff'
    }}>
      {/* Header */}
      <div style={{ 
        background: '#3E2B3F',
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
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
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
        background: '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.length === 0 && sessionId && (
          <div style={{ 
            textAlign: 'center', 
            color: '#666', 
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
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : m.sender === 'system'
                ? '#fff3cd'
                : '#ffffff',
              color: m.sender === 'user' ? 'white' : '#333',
              fontSize: '14px',
              lineHeight: '1.5',
              boxShadow: m.sender !== 'system' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              border: m.sender === 'system' ? '1px solid #ffc107' : 'none'
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
                      color: conversationConcluded ? '#999' : '#667eea',
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
        background: 'white',
        borderTop: '1px solid #e0e0e0',
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
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: (sessionId && text.trim() && !conversationConcluded) ? 'pointer' : 'not-allowed',
            fontWeight: 500,
            fontSize: '14px',
            transition: 'opacity 0.2s'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
