import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Paperclip, X } from 'lucide-react';
import { useAttachmentUpload } from '../hooks/useAttachmentUpload';
import { useTyping } from '../hooks/useTyping';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

// Session expiration constants
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY_LAST_ACTIVE = 'ai-support-last-active';

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
  // Helper function to update last active timestamp
  const updateLastActive = () => {
    localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, Date.now().toString());
  };

  // Load sessionId from localStorage or use initialSessionId
  // BUT: Don't load if conversation was concluded or session expired
  const getStoredSessionId = () => {
    if (initialSessionId) return initialSessionId;

    // Check session expiration first
    const lastActiveStr = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
    if (lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      const timeSinceLastActive = Date.now() - lastActive;

      if (timeSinceLastActive > SESSION_TIMEOUT_MS) {
        // Session expired - clear all session data
        const storedSessionId = localStorage.getItem('ai-support-session-id');
        if (storedSessionId) {
          localStorage.removeItem('ai-support-session-id');
          localStorage.removeItem(`ai-support-messages-${storedSessionId}`);
          localStorage.removeItem(`ai-support-concluded-${storedSessionId}`);
          localStorage.removeItem(`ai-support-agent-timer-${storedSessionId}`);
          localStorage.removeItem(`ai-support-agent-request-sent-${storedSessionId}`);
          console.log(`⏰ Session expired (${Math.floor(timeSinceLastActive / 60000)} minutes inactive) - cleared session data`);
        }
        localStorage.removeItem(STORAGE_KEY_LAST_ACTIVE);
        return null; // Start fresh session
      }
    }

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
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; ts?: number; type?: string; attachmentUrl?: string; options?: Array<{ text: string; value: string }> }>>([]);
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isButtonBlinking, setIsButtonBlinking] = useState(false);
  const [conversationConcluded, setConversationConcluded] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [showOfflineForm, setShowOfflineForm] = useState(false);
  const [offlineFormData, setOfflineFormData] = useState({ name: '', email: '', mobile: '', query: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [agentRequestSent, setAgentRequestSent] = useState(false); // Track if agent request was sent
  const [showAgentButton, setShowAgentButton] = useState(false); // Show "Connect to Agent" button
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const [agentWaitTimer, setAgentWaitTimer] = useState<number | null>(null); // Countdown timer in seconds (180 = 3 minutes)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const messagesLoadedRef = useRef(false); // Track if messages have been loaded
  const socketRef = useRef<Socket | null>(null); // Store socket instance
  const chatTimeoutRef = useRef<number | null>(null); // 3-minute timer
  const agentButtonShownRef = useRef(false); // Track if button has been shown for current showAgentButton state
  const agentWaitTimerIntervalRef = useRef<number | null>(null); // Interval for countdown timer
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null); // Ref for paperclip button position

  const { uploadFile } = useAttachmentUpload();

  // Initialize typing indicator hook
  const currentUser = {
    name: 'Visitor',
    role: 'user'
  };
  const { remoteTypingUser, handleInput: handleTypingInput } = useTyping({
    socket: socketRef.current,
    sessionId,
    currentUser
  });

  // Business hours check (Mon-Fri, 09:00 - 17:00)
  // TEST MODE: Add ?testBusinessHours=false to URL to force offline form
  // Add ?testBusinessHours=true to force business hours (show chat)
  const isBusinessHours = (): boolean => {
    // Check for test override in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const testOverride = urlParams.get('testBusinessHours');
    if (testOverride === 'false') {
      console.log('🧪 TEST MODE: Forcing offline (business hours = false)');
      return false;
    }
    if (testOverride === 'true') {
      console.log('🧪 TEST MODE: Forcing business hours (business hours = true)');
      return true;
    }

    // Normal business hours check
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = now.getHours();

    // Monday to Friday (1-5)
    if (day >= 1 && day <= 5) {
      // 09:00 to 17:00
      return hour >= 9 && hour < 17;
    }
    return false;
  };

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

        // MIGRATION: Fix old offline form messages missing the type
        // This ensures users with cached messages see the form, not just text
        loadedMessages.forEach((msg: any) => {
          if (msg.sender === 'system' && msg.text &&
            (msg.text.includes('Sorry, agent is busy') || msg.text.includes('Sorry, our agents are currently busy')) &&
            !msg.type) {
            msg.type = 'offline_form';
            console.log('🔧 Migrated legacy offline form message to include type');
          }
        });

        setMessages(loadedMessages);
        messagesLoadedRef.current = true;
        // Switch to chat mode only if sessionId exists (real session, not just FAQ Q&A)
        if (loadedMessages.length > 0 && sid) {
          setIsChatMode(true);
        }
        // Restore showOfflineForm state if offline form message exists in messages
        const hasOfflineFormMessage = loadedMessages.some((msg: any) => msg.type === 'offline_form');
        if (hasOfflineFormMessage) {
          setShowOfflineForm(true);
          console.log('📋 Restored showOfflineForm state from messages');
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
      // Update last active timestamp when loading existing session
      updateLastActive();
      loadMessagesFromStorage(sessionId);
    }
  }, [sessionId]);

  // Restore agent wait timer from localStorage on mount/reload
  useEffect(() => {
    if (sessionId) {
      try {
        // Check if agent request was already sent in this session
        const agentRequestSentInSession = localStorage.getItem(`ai-support-agent-request-sent-${sessionId}`);
        if (agentRequestSentInSession === 'true') {
          console.log(`🔒 Agent request already sent in this session ${sessionId} - button will not show again`);
          setAgentRequestSent(true);
        }

        const savedTimerData = localStorage.getItem(`ai-support-agent-timer-${sessionId}`);
        if (savedTimerData) {
          const timerData = JSON.parse(savedTimerData);
          const { startTime, duration } = timerData;
          const elapsed = Math.floor((Date.now() - startTime) / 1000); // Elapsed time in seconds
          const remaining = Math.max(0, duration - elapsed); // Remaining time (can't be negative)

          console.log(`🔄 Restoring agent timer: ${remaining}s remaining (elapsed: ${elapsed}s)`);

          if (remaining > 0) {
            // Timer is still active, restore it
            setAgentRequestSent(true);
            setAgentWaitTimer(remaining);

            // Clear any existing timer interval
            if (agentWaitTimerIntervalRef.current) {
              clearInterval(agentWaitTimerIntervalRef.current);
            }

            // Start countdown interval from restored time
            agentWaitTimerIntervalRef.current = window.setInterval(() => {
              setAgentWaitTimer(prev => {
                if (prev === null || prev <= 0) {
                  // Timer reached 0, show offline form
                  if (agentWaitTimerIntervalRef.current) {
                    clearInterval(agentWaitTimerIntervalRef.current);
                    agentWaitTimerIntervalRef.current = null;
                  }

                  // Clear timer from localStorage
                  if (sessionId) {
                    localStorage.removeItem(`ai-support-agent-timer-${sessionId}`);
                  }

                  console.log('⏰ Agent wait timer expired - showing offline form as chat message');
                  // Add offline form as a chat message instead of separate form
                  setMessages(prev => {
                    // Check if offline form message already exists
                    const hasOfflineFormMessage = prev.some(msg =>
                      msg.type === 'offline_form'
                    );

                    if (!hasOfflineFormMessage) {
                      setShowOfflineForm(true); // Ensure inputs are disabled
                      return [...prev, {
                        sender: 'system',
                        text: 'Sorry, our agents are currently busy. Please fill this form and we will get back to you.',
                        type: 'offline_form',
                        ts: Date.now()
                      }];
                    }
                    return prev;
                  });
                  setOfflineFormData(prev => ({ ...prev, query: prev.query || '' }));

                  return null;
                }

                return prev - 1; // Decrease by 1 second
              });
            }, 1000); // Update every second
          } else {
            // Timer already expired, show offline form as chat message
            console.log('⏰ Restored timer already expired - showing offline form as chat message');
            localStorage.removeItem(`ai-support-agent-timer-${sessionId}`);
            setOfflineFormData(prev => ({ ...prev, query: prev.query || '' }));
            setMessages(prev => {
              // Check if offline form message already exists
              const hasOfflineFormMessage = prev.some(msg =>
                msg.type === 'offline_form'
              );

              if (!hasOfflineFormMessage) {
                return [...prev, {
                  sender: 'system',
                  text: 'Sorry, agent is busy. Please fill this form and we will get back to you.',
                  type: 'offline_form',
                  ts: Date.now()
                }];
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('Failed to restore agent timer from localStorage:', err);
        // Clear corrupted data
        localStorage.removeItem(`ai-support-agent-timer-${sessionId}`);
      }
    }
  }, [sessionId]);

  // Cleanup agent wait timer on unmount
  useEffect(() => {
    return () => {
      if (agentWaitTimerIntervalRef.current) {
        clearInterval(agentWaitTimerIntervalRef.current);
        agentWaitTimerIntervalRef.current = null;
      }
    };
  }, []);

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
      // Clear agent request flag for new session (allows button to show again)
      if (newSessionId) {
        localStorage.removeItem(`ai-support-agent-request-sent-${newSessionId}`);
        setAgentRequestSent(false);
        setShowAgentButton(false);
        console.log(`🆕 New session ${newSessionId} - cleared agent request flag`);
      }
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

      // Update last active timestamp when bot streams (keeps session alive)
      updateLastActive();

      // Update streaming text - it will be hidden automatically if a matching bot_message exists
      setStreamingText(m.text);
    });
    socket.on('bot_message', (m: any) => {
      stopTypingIndicator();
      console.log('📨 Widget received bot_message:', m);

      // Update last active timestamp when bot replies
      updateLastActive();

      // Clear any in-progress streaming text immediately when final message arrives
      setStreamingText(null);

      // Clear chat timeout when bot responds
      if (chatTimeoutRef.current) {
        window.clearTimeout(chatTimeoutRef.current);
        chatTimeoutRef.current = null;
      }

      // AI Failure Detection: If confidence === 0, show offline form as chat message (NOT agent button)
      if (m.confidence === 0) {
        console.log('❌ AI failed (confidence === 0), showing offline form as chat message');

        // Ensure agent button is NOT shown when AI fails
        setShowAgentButton(false);
        agentButtonShownRef.current = false;

        // Set showOfflineForm to disable input controls
        setShowOfflineForm(true);

        setMessages(prev => {
          // Get the last user message for the query field from current messages
          const lastUserMessage = prev.filter(msg => msg.sender === 'user').pop()?.text || '';
          setOfflineFormData(formPrev => ({ ...formPrev, query: formPrev.query || lastUserMessage }));

          // Check if offline form message already exists
          const hasOfflineFormMessage = prev.some(msg =>
            msg.type === 'offline_form'
          );

          if (!hasOfflineFormMessage) {
            return [...prev, {
              sender: 'system',
              text: 'Our AI is having trouble. Please fill this form so an agent can help.',
              ts: Date.now()
            }, {
              sender: 'system',
              text: '',
              type: 'offline_form',
              ts: Date.now()
            }];
          }
          return prev;
        });
        return;
      }

      // Switch to chat mode when receiving real bot messages from socket
      setIsChatMode(true);

      // Handle offline form message separately (before adding to messages)
      if (m.type === 'offline_form') {
        console.log('📋 Received offline form trigger from backend');

        // Set showOfflineForm to disable input controls
        setShowOfflineForm(true);

        setMessages(prev => {
          // Get the last user message for the query field from current messages
          const lastUserMessage = prev.filter(msg => msg.sender === 'user').pop()?.text || '';
          setOfflineFormData(formPrev => ({ ...formPrev, query: formPrev.query || lastUserMessage }));

          // Check if offline form message already exists
          const hasOfflineFormMessage = prev.some(msg =>
            msg.type === 'offline_form'
          );

          if (!hasOfflineFormMessage) {
            return [...prev, {
              sender: 'system',
              text: '',
              type: 'offline_form',
              ts: Date.now()
            }];
          }
          return prev; // Don't add duplicate
        });
        return; // Don't process as regular bot message
      }

      setMessages(prev => {
        // Handle business hours message from backend - add it separately
        if (m.type === 'business_hours_message') {
          console.log('🌙 Received business hours message from backend');
          // Check if business hours message already exists
          const hasBusinessHoursMessage = prev.some(msg =>
            msg.type === 'business_hours_message'
          );

          if (!hasBusinessHoursMessage) {
            return [...prev, {
              sender: 'bot',
              text: m.text || 'An agent will contact you during business hours.',
              type: 'business_hours_message',
              ts: Date.now()
            }];
          }
          return prev; // Don't add duplicate
        }

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

        // Check if backend explicitly requested to show agent button
        // Only show if agent request hasn't been sent in this session AND during business hours
        if (m.showAgentButton === true) {
          const agentRequestSentInSession = sessionId ?
            localStorage.getItem(`ai-support-agent-request-sent-${sessionId}`) === 'true' : false;

          // Check business hours
          const inBusinessHours = isBusinessHours();

          if (!agentRequestSentInSession && inBusinessHours) {
            console.log('🤖 Backend requested to show agent button (business hours)');
            setShowAgentButton(true);
            agentButtonShownRef.current = false; // Reset so button can appear
          } else {
            console.log('🔒 Backend requested button but conditions not met (already sent or outside business hours)');
          }
        }

        // If showAgentButton is true and we haven't shown the button yet, mark that we should show it
        if (showAgentButton && !agentButtonShownRef.current) {
          console.log('🤖 Bot message received after "agent" keyword detected - button should appear');
          agentButtonShownRef.current = true; // Mark that button should be shown for this bot message
        }

        return [...prev, {
          sender: 'bot',
          text: m.text,
          ts: Date.now(),
          type: m.type,
          attachmentUrl: m.attachmentUrl,
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

      // Clear chat timeout when agent responds
      if (chatTimeoutRef.current) {
        window.clearTimeout(chatTimeoutRef.current);
        chatTimeoutRef.current = null;
      }

      setShowOfflineForm(false); // Hide offline form when agent responds

      setMessages(prev => {
        // Check for duplicates - text AND attachmentUrl should be unique for recent messages
        const exists = prev.some(msg =>
          msg.sender === 'agent' &&
          msg.text === m.text &&
          msg.attachmentUrl === m.attachmentUrl &&
          (msg.ts && Date.now() - msg.ts < 5000)
        );

        if (exists) {
          console.log('   ⚠️  Duplicate agent message, skipping');
          return prev;
        }
        console.log('   ✅ Adding agent message to widget:', m.type === 'image' ? 'Image Attachment' : 'Text');
        return [...prev, {
          sender: 'agent',
          text: m.text,
          type: m.type,
          attachmentUrl: m.attachmentUrl,
          ts: Date.now()
        }];
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

      // Clear the agent wait timer since agent has joined
      if (agentWaitTimerIntervalRef.current) {
        clearInterval(agentWaitTimerIntervalRef.current);
        agentWaitTimerIntervalRef.current = null;
      }
      setAgentWaitTimer(null);

      // Reset agent request sent flag so button can appear again if needed
      // This allows the button to show again if user needs another agent later
      setAgentRequestSent(false);

      // Clear timer and agent request flag from localStorage
      if (sessionId) {
        localStorage.removeItem(`ai-support-agent-timer-${sessionId}`);
        localStorage.removeItem(`ai-support-agent-request-sent-${sessionId}`);
        console.log('🗑️  Cleared agent timer and request flag from localStorage');
      }

      console.log('✅ Agent joined - cleared wait timer and reset agent request flag');

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

        // Clear agent wait timer
        if (agentWaitTimerIntervalRef.current) {
          clearInterval(agentWaitTimerIntervalRef.current);
          agentWaitTimerIntervalRef.current = null;
        }
        setAgentWaitTimer(null);

        // Clear ALL localStorage when agent closes conversation
        if (sessionId) {
          localStorage.removeItem('ai-support-session-id');
          localStorage.removeItem(`ai-support-messages-${sessionId}`);
          localStorage.removeItem(`ai-support-concluded-${sessionId}`);
          localStorage.removeItem(`ai-support-agent-timer-${sessionId}`);
          localStorage.removeItem(`ai-support-agent-request-sent-${sessionId}`);
          console.log('🧹 Cleared localStorage - conversation closed by agent');
        }
        // Clear messages and reset state, then show notification
        setStreamingText(null);
        messagesLoadedRef.current = false;
        // Show notification message to user
        setMessages([{ sender: 'system', text: 'This chat has been resolved, Thankyou.', ts: Date.now() }]);

        // Auto-reset widget after 3 seconds
        setTimeout(() => {
          console.log('🔄 Auto-resetting widget to initial state');
          setConversationConcluded(false);
          setSessionId(null);
          setMessages([]);
          setIsChatMode(false);
          setShowOfflineForm(false);
          setConnectionError(null);
          // Ensure localStorage is clean (redundant but safe)
          if (sessionId) {
            localStorage.removeItem('ai-support-session-id');
            localStorage.removeItem(`ai-support-messages-${sessionId}`);
            localStorage.removeItem(`ai-support-concluded-${sessionId}`);
          }
        }, 3000);
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

      // Cleanup agent wait timer on unmount
      if (agentWaitTimerIntervalRef.current) {
        clearInterval(agentWaitTimerIntervalRef.current);
        agentWaitTimerIntervalRef.current = null;
      }
    };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function start() {
    const socket = socketRef.current;
    if (!socket) return;

    // Check business hours before starting chat - ALLOW offline chat for AI
    // if (!isBusinessHours()) {
    //   setShowOfflineForm(true);
    //   return;
    // }

    // Hide offline form when starting chat (whether in business hours or not)
    setShowOfflineForm(false);

    // IMPORTANT: Always generate a NEW session ID when starting a chat
    // This ensures "Start New Chat" creates a fresh session, not reusing the old one
    const sid = `s_${Date.now()}`;
    setSessionId(sid);
    // Store sessionId in localStorage
    localStorage.setItem('ai-support-session-id', sid);

    // Update last active timestamp when starting a new session
    updateLastActive();

    // Clear agent request flag for new session (allows button to show again)
    localStorage.removeItem(`ai-support-agent-request-sent-${sid}`);
    setAgentRequestSent(false);
    setShowAgentButton(false);
    console.log(`🆕 Starting new session ${sid} - cleared agent request flag`);

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
      // Check business hours - ALLOW offline chat for AI (remove blocker)
      // if (!isBusinessHours()) {
      //   setShowOfflineForm(true);
      //   return;
      // }

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

      // Emit request_human event ONLY during business hours
      // Outside business hours, we rely on AI response and fallback to form if AI fails
      if (isBusinessHours()) {
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
        console.log('🌙 Outside business hours - suppressed request_human event. User will interact with AI.');
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

  async function send() {
    const socket = socketRef.current;
    if (!socket || (!text.trim() && !selectedFile)) return;

    // Update last active timestamp when user sends a message
    updateLastActive();

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
      localStorage.setItem('ai-support-pending-message', messageToSend);
      return;
    }

    // Handle file attachment
    if (selectedFile) {
      setUploadingFile(true);
      try {
        const url = await uploadFile(selectedFile);
        const userMessage = text.trim() || 'Image';
        setMessages(prev => [...prev, { sender: 'user', text: userMessage, ts: Date.now(), type: 'image', attachmentUrl: url } as any]);
        socket.emit('user_message', {
          sessionId,
          text: userMessage,
          type: 'image',
          attachmentUrl: url
        });
        setText('');
        setSelectedFile(null);
        setPreviewUrl(null);
        setStreamingText(null);
        startTypingIndicator();
      } catch (error) {
        console.error('Failed to upload file:', error);
        alert('Failed to upload image. Please try again.');
      } finally {
        setUploadingFile(false);
      }
      return;
    }

    // Normal text message flow
    const userMessage = text.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMessage, ts: Date.now() }]);
    socket.emit('user_message', { sessionId, text: userMessage });
    setText('');
    setStreamingText(null);
    startTypingIndicator();

    // Keyword detection: Check if user mentions "agent"
    if (userMessage.toLowerCase().includes('agent')) {
      const agentRequestSentInSession = sessionId ?
        localStorage.getItem(`ai-support-agent-request-sent-${sessionId}`) === 'true' : false;
      const inBusinessHours = isBusinessHours();

      if (!agentRequestSentInSession && inBusinessHours) {
        console.log('🔍 Keyword "agent" detected in message (business hours):', userMessage);
        setShowAgentButton(true);
        agentButtonShownRef.current = false;
        console.log('✅ showAgentButton set to true, agentButtonShownRef reset');
      } else if (!agentRequestSentInSession && !inBusinessHours) {
        // Outside business hours - show message and offline form instead of button
        console.log('🌙 Keyword "agent" detected outside business hours - showing offline form');
        setShowOfflineForm(true);
        setMessages(prev => {
          // Check if business hours message already exists
          const hasBusinessHoursMessage = prev.some(msg =>
            msg.type === 'business_hours_message'
          );

          if (!hasBusinessHoursMessage) {
            return [...prev, {
              sender: 'system',
              text: 'An agent will contact you during business hours.',
              type: 'business_hours_message',
              ts: Date.now()
            }, {
              sender: 'system',
              text: '',
              type: 'offline_form',
              ts: Date.now()
            }];
          }
          return prev;
        });
        setOfflineFormData(prev => ({ ...prev, query: prev.query || userMessage }));
      } else {
        console.log('🔒 Agent request already sent in this session - button will not show');
      }
    }

    // Start 3-minute timer when user sends a message
    if (chatTimeoutRef.current) {
      window.clearTimeout(chatTimeoutRef.current);
    }
    chatTimeoutRef.current = window.setTimeout(() => {
      console.log('⏰ 3-minute timeout expired, showing offline form');

      // Emit session_timeout event to backend (will create notification)
      const socket = socketRef.current;
      if (socket && sessionId && !conversationConcluded) {
        socket.emit('session_timeout', {
          sessionId,
          timestamp: new Date().toISOString()
        });
      }

      setShowOfflineForm(true);
      setOfflineFormData(prev => ({ ...prev, query: prev.query || userMessage }));
      setMessages(prev => [...prev, {
        sender: 'system',
        text: 'Sorry, agent is busy. Please fill this form and we will get back to you.',
        ts: Date.now()
      }]);
      chatTimeoutRef.current = null;
    }, 3 * 60 * 1000); // 3 minutes 3*60*1000
  }

  function handleRequestAgent() {
    const socket = socketRef.current;
    if (socket && sessionId) {
      socket.emit('request_agent', { sessionId });
      setAgentRequestSent(true);
      setShowAgentButton(false);
      agentButtonShownRef.current = false; // Reset ref

      // Mark that agent request was sent in this session (persist across reloads)
      localStorage.setItem(`ai-support-agent-request-sent-${sessionId}`, 'true');
      console.log(`🔒 Marked agent request as sent for session ${sessionId} - button will not show again`);

      // Remove the "Click the button below to talk to an agent." message immediately
      setMessages(prev => {
        return prev.filter(msg => {
          // Remove bot messages that contain the agent request prompt text
          // Check for both exact match and variations
          if (msg.sender === 'bot' && msg.text) {
            const textLower = msg.text.toLowerCase();
            const isAgentPromptMessage =
              textLower.includes('click the button below to talk to an agent') ||
              textLower.includes('click the button below') && textLower.includes('agent') ||
              msg.type === 'agent_request_prompt'; // Also check by type

            if (isAgentPromptMessage) {
              console.log('🗑️  Removing agent prompt message:', msg.text);
              return false; // Filter out this message
            }
          }
          return true; // Keep all other messages
        });
      });

      // Start 3-minute countdown timer (180 seconds)
      const TIMER_DURATION = 3 * 60; // 3 minutes in seconds
      const timerStartTime = Date.now();

      // Save timer start time to localStorage for persistence across reloads
      if (sessionId) {
        localStorage.setItem(`ai-support-agent-timer-${sessionId}`, JSON.stringify({
          startTime: timerStartTime,
          duration: TIMER_DURATION
        }));
        console.log(`💾 Saved agent timer to localStorage for session ${sessionId}`);
      }

      setAgentWaitTimer(TIMER_DURATION);
      console.log(`📤 Emitted request_agent event for session ${sessionId}, starting ${TIMER_DURATION}s timer`);

      // Clear any existing timer
      if (agentWaitTimerIntervalRef.current) {
        clearInterval(agentWaitTimerIntervalRef.current);
      }

      // Start countdown interval
      agentWaitTimerIntervalRef.current = window.setInterval(() => {
        setAgentWaitTimer(prev => {
          if (prev === null || prev <= 0) {
            // Timer reached 0, show offline form
            if (agentWaitTimerIntervalRef.current) {
              clearInterval(agentWaitTimerIntervalRef.current);
              agentWaitTimerIntervalRef.current = null;
            }

            // Clear timer from localStorage
            if (sessionId) {
              localStorage.removeItem(`ai-support-agent-timer-${sessionId}`);
            }

            console.log('⏰ Agent wait timer expired - showing offline form as chat message');
            // Add offline form as a chat message instead of separate form
            setMessages(prev => {
              // Check if offline form message already exists
              const hasOfflineFormMessage = prev.some(msg =>
                msg.type === 'offline_form'
              );

              if (!hasOfflineFormMessage) {
                setShowOfflineForm(true); // Ensure inputs are disabled
                return [...prev, {
                  sender: 'system',
                  text: 'Sorry, our agents are currently busy. Please fill this form and we will get back to you.',
                  type: 'offline_form',
                  ts: Date.now()
                }];
              }
              return prev;
            });
            setOfflineFormData(prev => ({ ...prev, query: prev.query || '' }));

            return null;
          }

          // Update localStorage with current remaining time
          if (sessionId && prev > 0) {
            const elapsed = TIMER_DURATION - prev;
            const currentStartTime = timerStartTime + (elapsed * 1000);
            localStorage.setItem(`ai-support-agent-timer-${sessionId}`, JSON.stringify({
              startTime: currentStartTime,
              duration: TIMER_DURATION
            }));
          }

          return prev - 1; // Decrease by 1 second
        });
      }, 1000); // Update every second
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Handle offline form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!offlineFormData.name || !offlineFormData.email || !offlineFormData.query) {
      setFormError('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: offlineFormData.name,
          email: offlineFormData.email,
          mobile: offlineFormData.mobile,
          query: offlineFormData.query,
          sessionId: sessionId || null
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to submit ticket' }));
        throw new Error(error.error || 'Failed to submit ticket');
      }

      setFormSubmitted(true);
      setMessages(prev => [...prev, {
        sender: 'system',
        text: 'Query noted. Check your mail.',
        ts: Date.now()
      }]);

      // Clear chat after 3 seconds
      setTimeout(() => {
        clearChatState();
      }, 3000);
    } catch (err: any) {
      console.error('Error submitting ticket:', err);
      setFormError(err?.message || 'Failed to submit ticket. Please try again.');
    }
  };

  // Function to clear chat state
  const clearChatState = () => {
    // Clear messages
    setMessages([]);

    // Clear session data
    if (sessionId) {
      localStorage.removeItem('ai-support-session-id');
      localStorage.removeItem(`ai-support-messages-${sessionId}`);
      localStorage.removeItem(`ai-support-concluded-${sessionId}`);
    }

    // Clear form state
    setFormSubmitted(false);
    setShowOfflineForm(false);
    setOfflineFormData({ name: '', email: '', mobile: '', query: '' });
    setFormError(null);

    // Reset chat mode
    setIsChatMode(false);
    setSessionId(null);
    setConversationConcluded(false);
    setStreamingText(null);

    // Clear timers
    if (chatTimeoutRef.current) {
      window.clearTimeout(chatTimeoutRef.current);
      chatTimeoutRef.current = null;
    }

    console.log('🧹 Chat state cleared');
  };

  // Check business hours on mount - show offline form if outside business hours and no active session
  // Check business hours on mount - show offline form if outside business hours and no active session
  // Check business hours on mount - REMOVED to allow FAQ flow first
  // Users will see offline form only when they try to talk to an agent
  /*
  useEffect(() => {
    if (!isBusinessHours() && !sessionId && !showOfflineForm && !isChatMode) {
      setShowOfflineForm(true);
    }
  }, []);
  */

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (chatTimeoutRef.current) {
        window.clearTimeout(chatTimeoutRef.current);
      }
    };
  }, []);

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
          {/* Only show "Start Chat" button in chat mode when session doesn't exist AND conversation is not concluded */}
          {isChatMode && !sessionId && !conversationConcluded && (
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
        {/* Offline Form - REMOVED (now rendered as a chat message) */}

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
            {m.type === 'offline_form' ? (
              // Render offline form inline as chat message
              <div style={{
                maxWidth: '100%',
                width: '100%',
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                color: '#000000',
                marginTop: '8px'
              }}>
                {formSubmitted ? (
                  <div style={{ textAlign: 'center', color: '#4CAF50' }}>
                    <p style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>✓ Query noted. Check your mail.</p>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Contact Form</h3>
                    {formError && (
                      <div style={{
                        background: '#ffebee',
                        color: '#c62828',
                        padding: '10px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '14px'
                      }}>
                        {formError}
                      </div>
                    )}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                        Name <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={offlineFormData.name}
                        onChange={(e) => setOfflineFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                        Email <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="email"
                        value={offlineFormData.email}
                        onChange={(e) => setOfflineFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                        Mobile
                      </label>
                      <input
                        type="tel"
                        value={offlineFormData.mobile}
                        onChange={(e) => setOfflineFormData(prev => ({ ...prev, mobile: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                        Query <span style={{ color: 'red' }}>*</span>
                      </label>
                      <textarea
                        value={offlineFormData.query}
                        onChange={(e) => setOfflineFormData(prev => ({ ...prev, query: e.target.value }))}
                        required
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #000000 0%, #ffffff 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Submit Query
                    </button>
                  </form>
                )}
              </div>
            ) : (
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
                {/* Image Attachment Rendering */}
                {m.type === 'image' && (m as any).attachmentUrl ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div
                      onClick={() => {
                        setImageToView((m as any).attachmentUrl);
                        setShowImageViewer(true);
                      }}
                      style={{
                        display: 'block',
                        maxWidth: '100%',
                        cursor: 'pointer',
                        textDecoration: 'none'
                      }}
                    >
                      <img
                        src={(m as any).attachmentUrl}
                        alt="Attachment"
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: '8px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        }}
                      />
                    </div>
                    {m.text && m.text !== 'Image' && (
                      <div style={{
                        fontSize: '13px',
                        color: m.sender === 'system' ? '#ffffff' : '#000000',
                        lineHeight: '1.4',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word'
                      }}>
                        {m.text}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Text-only message */
                  m.text
                )}
              </div>
            )}
            {/* Connect to Agent Button - Show after bot messages when user mentions "agent" */}
            {/* Show button after the LAST bot message when showAgentButton is true */}
            {(() => {
              const isLastMessage = i === messages.length - 1;
              const shouldShowButton = m.sender === 'bot' && isLastMessage && showAgentButton && !agentRequestSent;

              if (m.sender === 'bot' && showAgentButton) {
                console.log('🔘 Button render check for bot message:', {
                  sender: m.sender,
                  messageIndex: i,
                  totalMessages: messages.length,
                  isLastMessage,
                  showAgentButton,
                  agentRequestSent,
                  agentButtonShown: agentButtonShownRef.current,
                  shouldShow: shouldShowButton
                });
              }

              return shouldShowButton;
            })() && (
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={handleRequestAgent}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3), 0 2px 4px rgba(0,0,0,0.1)',
                      transform: 'translateY(0)',
                      width: '100%',
                      maxWidth: '280px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.4), 0 4px 6px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.3), 0 2px 4px rgba(0,0,0,0.1)';
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3), 0 1px 2px rgba(0,0,0,0.1)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.4), 0 4px 6px rgba(0,0,0,0.15)';
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>Connect to Agent</span>
                  </button>
                </div>
              )}
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

        {/* Show FAQ menu when not in chat mode, no session exists, and not showing offline form */}
        {!isChatMode && !sessionId && !showOfflineForm && (
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

        {/* Agent Wait Timer - Show when agent request is sent (at bottom of messages) */}
        {agentRequestSent && agentWaitTimer !== null && agentWaitTimer > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            margin: '12px 0',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#ffffff'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Agent will join in</span>
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#667eea',
              fontFamily: 'monospace',
              letterSpacing: '1px'
            }}>
              {(() => {
                const minutes = Math.floor(agentWaitTimer / 60);
                const seconds = agentWaitTimer % 60;
                if (minutes > 0) {
                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
                return `${seconds}s`;
              })()}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontStyle: 'italic'
            }}>
              {agentWaitTimer > 60 ? 'Please wait...' : 'Almost there...'}
            </div>
          </div>
        )}

        {/* Typing Indicator in Message Area */}
        {remoteTypingUser && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: '4px',
            padding: '8px 16px'
          }}>
            <div style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontStyle: 'italic',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}>
              {remoteTypingUser} is typing<span style={{ animation: 'blink 1.4s infinite' }}>...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* File Preview Area */}
      {selectedFile && previewUrl && (
        <div style={{
          padding: '12px 16px',
          background: '#f8f9fa',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <img
            src={previewUrl}
            alt="Preview"
            style={{
              width: '60px',
              height: '60px',
              objectFit: 'cover',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}
          />
          <div style={{ flex: 1, fontSize: '14px', color: '#495057' }}>
            <div style={{ fontWeight: 500 }}>{selectedFile.name}</div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedFile(null);
              setPreviewUrl(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            style={{
              padding: '8px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input Area */}
      {isChatMode && !showOfflineForm && (
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
          overflow: 'visible',
          margin: 0,
          position: 'relative',
          zIndex: 10
        }}>
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              // Size validation (50MB)
              if (file.size > 50 * 1024 * 1024) {
                alert('File too large. Maximum size is 50MB.');
                e.target.value = '';
                return;
              }

              // Type validation
              if (!['image/png', 'image/jpeg'].includes(file.type)) {
                alert('Only PNG and JPEG images are allowed.');
                e.target.value = '';
                return;
              }

              // Set file and preview
              setSelectedFile(file);
              setPreviewUrl(URL.createObjectURL(file));
              setShowAttachmentMenu(false);
            }}
          />

          {/* Paperclip Icon Button */}
          <div style={{ position: 'relative' }}>
            <button
              ref={attachButtonRef}
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              disabled={!sessionId || conversationConcluded || uploadingFile || showOfflineForm}
              style={{
                padding: '10px',
                background: '#f8f9fa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: (sessionId && !conversationConcluded && !uploadingFile && !showOfflineForm) ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (sessionId && !conversationConcluded && !uploadingFile && !showOfflineForm) ? 1 : 0.5
              }}
            >
              <Paperclip size={20} color="#495057" />
            </button>

            {/* Attachment Menu Popup */}
            {showAttachmentMenu && (() => {
              const buttonRect = attachButtonRef.current?.getBoundingClientRect();
              const menuBottom = buttonRect ? window.innerHeight - buttonRect.top + 8 : 100;
              const menuLeft = buttonRect ? buttonRect.left : 50;

              return (
                <div style={{
                  position: 'fixed',
                  bottom: `${menuBottom}px`,
                  left: `${menuLeft}px`,
                  background: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  minWidth: '180px',
                  zIndex: 99999
                }}>
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #dee2e6',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#212529',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    📁 Computer
                  </button>
                  <button
                    onClick={() => {
                      console.log('Google Drive integration coming soon...');
                      setShowAttachmentMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#212529',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    ☁️ Google Drive
                  </button>
                </div>
              );
            })()}
          </div>

          <input
            value={text}
            onChange={e => {
              setText(e.target.value);
              handleTypingInput(); // Trigger typing indicator
            }}
            onKeyPress={handleKeyPress}
            disabled={!sessionId || conversationConcluded || agentRequestSent || (agentWaitTimer !== null && agentWaitTimer > 0) || showOfflineForm}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              background: (sessionId && !conversationConcluded && !agentRequestSent && !(agentWaitTimer !== null && agentWaitTimer > 0) && !showOfflineForm) ? 'white' : '#f5f5f5',
              minWidth: 0,
              maxWidth: '100%',
              boxSizing: 'border-box',
              width: '100%',
              margin: 0,
              cursor: (agentRequestSent || (agentWaitTimer !== null && agentWaitTimer > 0) || showOfflineForm) ? 'not-allowed' : 'text'
            }}
            placeholder={
              showOfflineForm
                ? "Please fill the form above"
                : agentRequestSent || (agentWaitTimer !== null && agentWaitTimer > 0)
                  ? "Waiting for agent to join..."
                  : conversationConcluded
                    ? "Conversation ended. Click 'Start Chat' for a new session"
                    : sessionId
                      ? "Type your message..."
                      : "Click 'Start Chat' to begin"
            }
          />
          <button
            onClick={send}
            disabled={!sessionId || (!text.trim() && !selectedFile) || conversationConcluded || agentRequestSent || (agentWaitTimer !== null && agentWaitTimer > 0) || uploadingFile || showOfflineForm}
            style={{
              padding: '10px 16px',
              background: (sessionId && text.trim() && !conversationConcluded && !agentRequestSent && !(agentWaitTimer !== null && agentWaitTimer > 0) && !showOfflineForm)
                ? 'linear-gradient(135deg, #000000 0%, #ffffff 100%)'
                : '#ccc',
              color: (sessionId && text.trim() && !conversationConcluded && !agentRequestSent && !(agentWaitTimer !== null && agentWaitTimer > 0) && !showOfflineForm) ? '#ffffff' : '#666',
              textShadow: (sessionId && text.trim() && !conversationConcluded && !agentRequestSent && !(agentWaitTimer !== null && agentWaitTimer > 0) && !showOfflineForm) ? '0 1px 2px rgba(0, 0, 0, 0.5)' : 'none',
              border: 'none',
              borderRadius: '8px',
              cursor: (sessionId && text.trim() && !conversationConcluded && !agentRequestSent && !(agentWaitTimer !== null && agentWaitTimer > 0) && !showOfflineForm) ? 'pointer' : 'not-allowed',
              fontWeight: 500,
              fontSize: '14px',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxSizing: 'border-box',
              margin: 0
            }}
          >
            {uploadingFile ? 'Uploading...' : 'Send'}
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
      {/* Image Viewer Modal */}
      {showImageViewer && imageToView && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            cursor: 'zoom-out',
            padding: '10px',
            borderRadius: '16px'
          }}
          onClick={() => setShowImageViewer(false)}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              justifyContent: 'center'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowImageViewer(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                fontSize: '18px',
                zIndex: 10001
              }}
            >
              ×
            </button>
            <img
              src={imageToView}
              alt="Full view"
              style={{
                maxWidth: '100%',
                maxHeight: '90%',
                borderRadius: '8px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                objectFit: 'contain'
              }}
            />
            <div style={{
              marginTop: '10px',
              display: 'flex',
              gap: '10px'
            }}>
              <a
                href={imageToView}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '12px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  padding: '4px 10px',
                  borderRadius: '4px'
                }}
              >
                Open Original ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
