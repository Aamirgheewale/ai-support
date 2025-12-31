import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const FAQ_OPTIONS = [
  { id: 'register', label: 'How to register?', answer: 'To register, visit the VTU Internyet portal home page and click "Student Registration". Ensure you have your USN handy.' },
  { id: 'domain', label: 'Domain specific internship?', answer: 'Yes, you can filter internships by domain (e.g., IoT, AI/ML, Web Dev) on the dashboard.' },
  { id: 'stipend', label: 'Internship with fees or stipend?', answer: 'The portal lists both paid (stipend) and paid-by-student (fees) internships. Check the "Type" tag on each listing.' },
  { id: 'not_listed', label: 'Organization not listed?', answer: 'The College Internship Coordinator must request the University to add the organization to the platform for approval.' },
  { id: 'types', label: 'What types of internships allowed?', answer: 'Allowed types: \n• BINT883A: Industry Internship \n• BINT883B: Research Internship \n• BINT883C: Skill Enhancement \n• BINT883D: Post Placement \n• BINT883E: Online Internship' },
  { id: 'complete', label: 'How to complete successfully?', answer: 'Upload your weekly reports and get them approved by your industry mentor and college guide.' },
  { id: 'other', label: 'Ask something else?', action: 'switch_to_chat' }
];

export default function EmbedWidget({ 
  initialSessionId,
  onAgentInitiatedChat,
  onClose
}: { 
  initialSessionId?: string;
  onAgentInitiatedChat?: () => void;
  onClose?: () => void;
}) {
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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isButtonBlinking, setIsButtonBlinking] = useState(false);
  const [conversationConcluded, setConversationConcluded] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const messagesLoadedRef = useRef(false); // Track if messages have been loaded
  const socketRef = useRef<Socket | null>(null); // Store socket instance

  // Extract host page data from query parameters (passed by embed.js)
  const getHostPageData = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const hostTitle = params.get('hostTitle');
      const hostUrl = params.get('hostUrl');
      return {
        title: hostTitle ? decodeURIComponent(hostTitle) : document.title,
        url: hostUrl ? decodeURIComponent(hostUrl) : window.location.href,
        referrer: document.referrer
      };
    } catch (err) {
      console.warn('Failed to parse query parameters, using fallback:', err);
      return {
        title: document.title,
        url: window.location.href,
        referrer: document.referrer
      };
    }
  };

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
        // Switch to chat mode only if sessionId exists (real session, not just FAQ Q&A)
        if (loadedMessages.length > 0 && sid) {
          setIsChatMode(true);
        }
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

  // Initialize socket connection immediately on mount (even if widget is closed)
  useEffect(() => {
    // Create socket connection
    let socket;
    try {
      console.log('🔌 Connecting to socket:', SOCKET_URL);
      socket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling']
      });
      socketRef.current = socket;
    } catch (error) {
      console.error('❌ Failed to create socket connection:', error);
      return;
    }
    
    // Helper function to emit visitor_join
    const emitVisitorJoin = () => {
      if (socket && socket.connected) {
        const hostData = getHostPageData();
        socket.emit('visitor_join', {
          url: hostData.url,
          title: hostData.title,
          referrer: hostData.referrer
        });
        console.log('👤 Visitor join event emitted:', { title: hostData.title, url: hostData.url });
      } else {
        console.warn('⚠️  Cannot emit visitor_join: socket not connected');
      }
    };
    
    // Emit visitor_join on connect (this will fire when socket connects)
    socket.on('connect', () => {
      console.log('ws connected', socket.id);
      setIsConnected(true);
      setConnectionError(null); // Clear any previous errors
      
      // Emit visitor_join immediately upon connection (before chat starts)
      emitVisitorJoin();
      
      // Join session room if sessionId exists
      if (sessionId) {
        socket.emit('join_session', { sessionId });
        console.log(`📱 Widget socket joined session room: ${sessionId}`);
        // Load messages from storage when reconnecting
        if (!messagesLoadedRef.current) {
          loadMessagesFromStorage(sessionId);
        }
      }
    });
    
    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('ws disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, try to reconnect manually
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      console.error('   Make sure the API server is running on', SOCKET_URL);
      setIsConnected(false);
      setConnectionError(`Cannot connect to server. Please ensure the API server is running on ${SOCKET_URL}`);
    });
    
    socket.on('reconnect', () => {
      console.log('ws reconnected', socket.id);
      setIsConnected(true);
      // Rejoin session room on reconnect
      if (sessionId) {
        socket.emit('join_session', { sessionId });
        console.log(`📱 Widget socket rejoined session room on reconnect: ${sessionId}`);
      }
      // Re-emit visitor_join on reconnect
      emitVisitorJoin();
    });
    
    // Listen for agent-initiated chat (proactive chat) - MUST be in same useEffect as socket creation
    socket.on('agent_initiated_chat', (data: any) => {
      console.log('📨 Received agent_initiated_chat:', data);
      const { sessionId: newSessionId, text, sender = 'bot' } = data || {};
      
      if (!newSessionId || !text) {
        console.warn('⚠️  Invalid agent_initiated_chat payload:', data);
        return;
      }
      
      // 1. Set isOpen to true (via callback)
      if (onAgentInitiatedChat) {
        onAgentInitiatedChat();
      }
      
      // 2. Save sessionId to localStorage
      localStorage.setItem('ai-support-session-id', newSessionId);
      
      // 3. Update sessionId state
      setSessionId(newSessionId);
      messagesLoadedRef.current = false;
      
      // 4. Append the received message to messages state as 'bot' message
      setMessages(prev => {
        // Check for duplicates
        const exists = prev.some(msg => 
          msg.sender === sender && 
          msg.text === text &&
          (msg.ts && Date.now() - msg.ts < 2000)
        );
        if (exists) {
          console.log(`   ⚠️  Duplicate ${sender} message, skipping`);
          return prev;
        }
        console.log(`   ✅ Adding ${sender} message to widget (initiated chat)`);
        return [...prev, { 
          sender: sender, // Use 'bot' as sender so it appears as bot message
          text: text, 
          ts: Date.now()
        }];
      });
      
      // Join the session room (this connects the widget to the session created by admin)
      console.log(`🔗 Connecting widget to session ${newSessionId} (created by admin initiate_chat)`);
      socket.emit('join_session', { sessionId: newSessionId });
      console.log(`📱 Widget joined session room for agent-initiated chat: ${newSessionId}`);
      console.log(`   ✅ Widget is now connected to the same session that was created by admin`);
      
      // 5. Play notification sound
      try {
        const popSound = new Audio('/sounds/pop.mp3');
        popSound.volume = 0.7;
        popSound.play().catch((err) => {
          console.warn('Could not play notification sound:', err);
        });
      } catch (err) {
        console.warn('Could not play notification sound:', err);
      }
    });
    
    // Also load messages on initial mount if sessionId exists
    const storedSessionId = getStoredSessionId();
    if (storedSessionId && !messagesLoadedRef.current) {
      loadMessagesFromStorage(storedSessionId);
    }
    
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect');
      socket.off('agent_initiated_chat');
      socket.disconnect();
    };
  }, [onAgentInitiatedChat]); // Include onAgentInitiatedChat in dependencies

  // Fetch theme on session start
  useEffect(() => {
    if (sessionId) {
      fetch(`${API_BASE}/session/${sessionId}/theme`)
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

  // Set up socket event listeners (separate from initialization)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    
    // Update sessionId dependency - rejoin room when sessionId changes
    if (sessionId) {
      socket.emit('join_session', { sessionId });
      console.log(`📱 Widget socket joined session room: ${sessionId}`);
      if (!messagesLoadedRef.current) {
        loadMessagesFromStorage(sessionId);
      }
    }
    
    socket.on('session_started', ({ sessionId: newSessionId }: any) => {
      setSessionId(newSessionId);
      // Store sessionId in localStorage for persistence
      if (newSessionId) {
        localStorage.setItem('ai-support-session-id', newSessionId);
        messagesLoadedRef.current = false; // Reset flag to allow loading messages
        socket.emit('join_session', { sessionId: newSessionId });
        console.log(`📱 Widget socket joined session room on start: ${newSessionId}`);
        
        // Check if there's a pending message to send
        const pendingMessage = localStorage.getItem('ai-support-pending-message');
        if (pendingMessage && socket) {
          localStorage.removeItem('ai-support-pending-message');
          setMessages(prev => [...prev, { sender: 'user', text: pendingMessage, ts: Date.now() }]);
          socket.emit('user_message', { sessionId: newSessionId, text: pendingMessage });
          startTypingIndicator();
        }
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
      
      // Switch to chat mode when receiving real bot messages from socket
      setIsChatMode(true);

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
      
      // Play notification sound for agent messages
      try {
        const popSound = new Audio('/sounds/pop.mp3');
        popSound.volume = 0.7;
        popSound.play().catch((err) => {
          console.warn('Could not play notification sound:', err);
        });
      } catch (err) {
        console.warn('Could not play notification sound:', err);
      }
    });
    socket.on('agent_joined', (data: any) => {
      console.log('📨 Widget received agent_joined:', data);
      // Ensure we're in the session room when agent joins
      if (sessionId) {
        socket.emit('join_session', { sessionId });
        console.log(`📱 Widget socket rejoined session room on agent join: ${sessionId}`);
      }
      // Use agentName if available, otherwise fall back to agentId
      const agentDisplayName = data.agentName || data.agentId || 'Agent';
      const messageText = `Agent ${agentDisplayName} joined the conversation`;
      
      // Check for duplicates before adding (prevent duplicate "Agent joined" messages)
      setMessages(prev => {
        // Check if a similar "Agent joined" message already exists
        // This catches both exact matches and variations (e.g., with name vs ID)
        const duplicate = prev.some(msg => 
          msg.sender === 'system' && 
          msg.text && 
          msg.text.includes('Agent') && 
          msg.text.includes('joined the conversation') &&
          msg.ts && Date.now() - msg.ts < 10000 // Within 10 seconds
        );
        
        if (duplicate) {
          console.log('⚠️  Duplicate agent_joined message detected, skipping');
          return prev;
        }
        
        console.log('✅ Adding agent_joined message to widget');
        return [...prev, { sender: 'system', text: messageText, ts: Date.now() }];
      });
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
    const socket = socketRef.current;
    if (!socket) return;
    
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
    // Don't reset isChatMode here - let it stay in chat mode if user initiated it
    messagesLoadedRef.current = false; // Reset loaded flag for new session
    
    // Include host page data in userMeta
    const hostData = getHostPageData();
    const userMeta = {
      title: hostData.title,
      url: hostData.url,
      referrer: hostData.referrer
    };
    
    socket.emit('start_session', { sessionId: sid, userMeta });
    // Trigger blinking animation
    setIsButtonBlinking(true);
    setTimeout(() => setIsButtonBlinking(false), 2000); // Stop after 2 seconds
  }
  
  function handleConclusionOption(optionValue: string, optionText: string) {
    const socket = socketRef.current;
    if (!socket || !sessionId || conversationConcluded) return; // Don't allow clicks if conversation is concluded
    
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

  function handleOptionClick(option: typeof FAQ_OPTIONS[0]) {
    if (option.action === 'switch_to_chat') {
      // Switch to chat mode and start session
      setIsChatMode(true);
      setMessages(prev => [...prev, { 
        sender: 'system', 
        text: "Go ahead, I'm listening. You can also ask for an agent.", 
        ts: Date.now() 
      }]);
      // Start session if it doesn't exist
      if (!sessionId) {
        start();
      }
      
      // Emit request_human event to trigger ring notification on admin dashboard
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit('request_human', {
          sessionId: sessionId || `s_${Date.now()}`,
          reason: 'user_clicked_ask_something_else'
        });
        console.log('📢 Emitted request_human event to trigger admin ring notification');
      } else {
        console.warn('⚠️  Cannot emit request_human: socket not connected');
      }
    } else {
      // Static question - add Q&A to messages locally without starting session
      // Keep menu visible (isChatMode stays false)
      if (option.answer) {
        setMessages(prev => [
          ...prev,
          { sender: 'user', text: option.label, ts: Date.now() },
          { sender: 'bot', text: option.answer, ts: Date.now() }
        ]);
      }
    }
  }

  function send() {
    const socket = socketRef.current;
    if (!socket || !text.trim()) return;
    
    // Switch to chat mode when user sends a message
    if (!isChatMode) {
      setIsChatMode(true);
    }
    
    // Start session if it doesn't exist
    if (!sessionId) {
      const messageToSend = text.trim();
      setText(''); // Clear input immediately
      start();
      // Store message to send after session starts
      // The session_started event handler will send it
      const pendingMessage = messageToSend;
      // Use a ref or state to store pending message, or use the session_started event
      // For now, we'll queue it in localStorage temporarily
      localStorage.setItem('ai-support-pending-message', pendingMessage);
      return;
    }
    
    // Normal flow: session exists
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

  // Hook to detect mobile on resize - use 640px as mobile breakpoint
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 640);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      className="ai-chat-widget"
      style={{ 
      // Fill parent container completely
      width: '100%',
      height: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
      overflow: 'hidden',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      background: '#000000',
      pointerEvents: 'auto',
      position: 'relative',
      boxSizing: 'border-box',
      margin: 0,
      padding: 0,
      borderRadius: '15px'
    }}>
      {/* Header */}
      <div style={{ 
        background: '#000000',
        color: 'white',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: '60px',
        position: 'relative',
        flexShrink: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        margin: 0
      }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', marginRight: '8px' }}>
          <div style={{ fontWeight: 600, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>AI Customer Support</div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: '1.2' }}>
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
                <span style={{ color: connectionError ? '#f44336' : '#999' }}>○</span>
                <span style={{ color: connectionError ? '#f44336' : 'inherit' }}>
                  {connectionError ? 'Connection Error' : 'Offline'}
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Only show "Start Chat" button in chat mode when session doesn't exist */}
          {isChatMode && (!sessionId || conversationConcluded) && (
            <button 
              onClick={start}
              className={isButtonBlinking ? 'start-button-blink' : ''}
              style={{
                background: 'linear-gradient(to top left, #000000, #ffffff)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                padding: isMobile ? '8px 14px' : '6px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: isMobile ? '13px' : '14px',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {conversationConcluded ? 'Start New Chat' : 'Start Chat'}
            </button>
          )}
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
                padding: 0,
                lineHeight: 1
              }}
              aria-label="Close chat"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div 
        className="chat-messages-container"
        style={{ 
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px',
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative',
          isolation: 'isolate',
          minHeight: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          margin: 0
        }}>
        {connectionError && (
          <div style={{ 
            textAlign: 'center', 
            color: '#ff6b6b', 
            fontSize: isMobile ? '12px' : '13px',
            padding: '16px',
            background: 'rgba(255, 107, 107, 0.1)',
            borderRadius: '8px',
            margin: '12px',
            border: '1px solid rgba(255, 107, 107, 0.3)'
          }}>
            ⚠️ {connectionError}
            <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.8 }}>
              Please start the API server: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>cd apps/api && node index.js</code>
            </div>
          </div>
        )}
        {/* Show messages in both modes (for FAQ Q&A) */}
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
              border: m.sender === 'system' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              boxSizing: 'border-box',
              overflow: 'hidden',
              margin: 0
            }}>
              {m.text}
            </div>
            {m.type === 'conclusion_question' && m.options && !conversationConcluded && (
              <div style={{
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxWidth: '75%',
                boxSizing: 'border-box',
                width: '100%',
                flexShrink: 0
              }}>
                {m.options.map((option, optIdx) => (
                  <button
                    key={optIdx}
                    onClick={() => handleConclusionOption(option.value, option.text)}
                    disabled={conversationConcluded}
                    style={{
                      padding: '10px 12px',
                      minHeight: '40px',
                      height: 'auto',
                      background: conversationConcluded 
                        ? 'rgba(200, 200, 200, 0.1)' 
                        : 'rgba(102, 126, 234, 0.1)',
                      border: conversationConcluded 
                        ? '1px solid rgba(200, 200, 200, 0.3)' 
                        : '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: isMobile ? '13px' : '14px',
                      cursor: conversationConcluded ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      opacity: conversationConcluded ? 0.5 : 1,
                      flexShrink: 0,
                      whiteSpace: 'normal',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      boxSizing: 'border-box'
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
        {isChatMode && streamingText && !messages.some(msg => msg.sender === 'bot' && msg.text === streamingText) && (
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
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              boxSizing: 'border-box',
              overflow: 'hidden',
              margin: 0
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
        
        {/* Show FAQ menu when not in chat mode and no session exists */}
        {!isChatMode && !sessionId && (
          <>
            <div style={{ 
              textAlign: 'left', 
              color: '#ffffff', 
              fontSize: '16px',
              padding: messages.length > 0 ? '8px 0' : '12px 0',
              fontWeight: 500,
              margin: 0,
              width: '100%',
              boxSizing: 'border-box'
            }}>
              {messages.length === 0 ? 'Hello! How Can i Help You:' : 'Select another topic:'}
            </div>
            {FAQ_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option)}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  minHeight: '40px',
                  height: 'auto',
                  marginBottom: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: 400,
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  whiteSpace: 'normal',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                {option.label}
              </button>
            ))}
          </>
        )}
        
        {/* Show empty state only in chat mode */}
        {isChatMode && messages.length === 0 && sessionId && !connectionError && (
          <div style={{ 
            textAlign: 'center', 
            color: '#ffffff', 
            fontSize: '14px',
            padding: '20px'
          }}>
            Type your message below to get started...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {isChatMode && (
        <div style={{ 
          padding: '16px',
          background: '#000000',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          gap: '8px',
          flexShrink: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          margin: 0
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
            background: (sessionId && !conversationConcluded) ? 'white' : '#f5f5f5',
            minWidth: 0,
            maxWidth: '100%',
            boxSizing: 'border-box',
            width: '100%',
            margin: 0
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
            padding: '10px 16px',
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
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxSizing: 'border-box',
            margin: 0
          }}
        >
          Send
        </button>
        </div>
      )}
      {!isChatMode && (
        <div style={{ 
          padding: '16px',
          background: '#000000',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '13px',
          flexShrink: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          margin: 0
        }}>
          Select an option above
        </div>
      )}
    </div>
  );
}
