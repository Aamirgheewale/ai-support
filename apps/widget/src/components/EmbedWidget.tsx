import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

export default function EmbedWidget({ initialSessionId }: { initialSessionId?: string }) {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; ts?: number }>>([]);
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    socket.on('connect', () => {
      console.log('ws connected', socket.id);
      setIsConnected(true);
    });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('session_started', ({ sessionId }) => setSessionId(sessionId));
    socket.on('bot_message', (m: any) => setMessages(prev => [...prev, { sender: 'bot', text: m.text, ts: Date.now() }]));
    socket.on('agent_message', (m: any) => setMessages(prev => [...prev, { sender: 'agent', text: m.text, ts: Date.now() }]));
    socket.on('agent_joined', (data: any) => {
      setMessages(prev => [...prev, { sender: 'system', text: `Agent ${data.agentId} joined the conversation`, ts: Date.now() }]);
    });
    socket.on('session_error', (err: any) => {
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
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function start() {
    const sid = sessionId || `s_${Date.now()}`;
    setSessionId(sid);
    setMessages([]);
    socket.emit('start_session', { sessionId: sid, userMeta: {} });
  }

  function send() {
    if (!text.trim() || !sessionId) return;
    setMessages(prev => [...prev, { sender: 'user', text: text.trim(), ts: Date.now() }]);
    socket.emit('user_message', { sessionId, text: text.trim() });
    setText('');
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>AI Customer Support</div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
            {isConnected ? '● Online' : '○ Offline'}
          </div>
        </div>
        {!sessionId && (
          <button 
            onClick={start}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '6px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px'
            }}
          >
            Start Chat
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
              justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
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
          </div>
        ))}
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
          disabled={!sessionId}
          style={{ 
            flex: 1, 
            padding: '10px 14px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            background: sessionId ? 'white' : '#f5f5f5'
          }} 
          placeholder={sessionId ? "Type your message..." : "Click 'Start Chat' to begin"} 
        />
        <button 
          onClick={send}
          disabled={!sessionId || !text.trim()}
          style={{
            padding: '10px 20px',
            background: sessionId && text.trim() 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: sessionId && text.trim() ? 'pointer' : 'not-allowed',
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
