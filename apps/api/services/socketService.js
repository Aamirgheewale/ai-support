/**
 * Socket Service - Socket.IO Connection Handler
 * 
 * This service handles all Socket.IO connections and events for real-time chat.
 * It uses dependency injection to accept all necessary dependencies.
 */

// ============================================================================
// PRELOADED RESPONSES - Constants for instant replies
// ============================================================================

const PRELOADED_RESPONSES_MAP = new Map([
  // Greetings
  ['hello', "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response."],
  ['hi', "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response."],
  ['hey', "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response."],
  ['hi there', "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response."],
  ['hello there', "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response."],
  ['hey there', "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response."],
  ['good morning', "Good morning! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response."],
  ['good afternoon', "Good afternoon! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response."],
  ['good evening', "Good evening! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response."],
  
  // Common initial questions
  ['what can you do', "I can help you with questions about VTU internyet portal. Ask me about services, plans, troubleshooting, or any portal-related queries."],
  ['what do you do', "I can help you with questions about VTU internyet portal. Ask me about services, plans, troubleshooting, or any portal-related queries."],
  ['how can you help', "I can help you with questions about VTU internyet portal. Ask me about services, plans, troubleshooting, or any portal-related queries."],
  ['how can you help me', "I can help you with questions about VTU internyet portal. Ask me about services, plans, troubleshooting, or any portal-related queries."],
  ['what are you', "I'm an AI chat assistant for VTU internyet portal. I can answer questions about services, plans, and help with portal-related issues."],
  ['who are you', "I'm an AI chat assistant for VTU internyet portal. I can answer questions about services, plans, and help with portal-related issues."],
  ['what is this', "This is a support chat for VTU internyet portal. I can help you with questions about services, plans, and portal-related queries."],
  ['help', "I'm here to help! Ask me any question related to VTU internyet portal - services, plans, troubleshooting, or account-related queries."],
  ['i need help', "I'm here to help! Ask me any question related to VTU internyet portal - services, plans, troubleshooting, or account-related queries."],
  ['can you help', "Yes, I can help! Ask me any question related to VTU internyet portal and I'll provide you with a quick response."],
  ['can you help me', "Yes, I can help! Ask me any question related to VTU internyet portal and I'll provide you with a quick response."],
  
  // Portal-specific common questions
  ['what is vtu', "VTU is a University"],
  ['what is vtu internyet portal', "VTU internyet portal provides internships. I can help you with questions about how to apply for internships, what will be the time duration, internships are paid(fees) or stipend based, etc. just ask"],
  ['tell me about vtu', "VTU is an internyet portal service. I can help you with questions about plans, services, account management, or troubleshooting."],
  ['about vtu', "VTU is an internyet portal service. I can help you with questions about plans, services, account management, or troubleshooting."],
  
  // Simple acknowledgments
  ['ok', "Got it! What would you like to know about VTU internyet portal?"],
  ['okay', "Got it! What would you like to know about VTU internyet portal?"],
  ['yes', "Great! What would you like to know about VTU internyet portal?"],
  ['yeah', "Great! What would you like to know about VTU internyet portal?"],
  ['sure', "Perfect! What would you like to know about VTU internyet portal?"],
]);

// Pre-compiled partial matches array (sorted by length, longest first for better matching)
const PARTIAL_MATCHES = [
  { key: 'what is vtu internyet portal', response: "VTU internyet portal provides internships. I can help you with questions about how to apply for internships, what will be the time duration, internships are paid(fees) or stipend based, etc. just ask." },
  { key: 'tell me about vtu', response: "VTU is an internyet portal service. I can help you with questions about plans, services, account management, or troubleshooting." },
  { key: 'how can you help me', response: "I can help you with questions about VTU internyet portal. Ask me about services, plans, troubleshooting, or any portal-related queries." },
  { key: 'can you help me', response: "Yes, I can help! Ask me any question related to VTU internyet portal and I'll provide you with a quick response." },
  { key: 'i need help', response: "I'm here to help! Ask me any question related to VTU internyet portal - services, plans, troubleshooting, or account-related queries." },
  { key: 'hello', response: "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response." },
  { key: 'hi', response: "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response." },
  { key: 'hey', response: "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response." },
  { key: 'what can you', response: "I can help you with questions about VTU internyet portal. Ask me about services, plans, troubleshooting, or any portal-related queries." },
  { key: 'what do you', response: "I can help you with questions about VTU internyet portal. Ask me about services, plans, troubleshooting, or any portal-related queries." },
  { key: 'how can you', response: "I can help you with questions about VTU internyet portal. Ask me about services, plans, troubleshooting, or any portal-related queries." },
  { key: 'what is vtu', response: "VTU is a University" },
  { key: 'tell me about', response: "I can help you with questions about VTU internyet portal. Ask me about services, plans, troubleshooting, or any portal-related queries." },
  { key: 'can you help', response: "Yes, I can help! Ask me any question related to VTU internyet portal and I'll provide you with a quick response." },
];

function getPreloadedResponse(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return null;
  }
  
  // Fast normalization: lowercase, trim, remove punctuation, remove extra spaces
  const normalized = userMessage.toLowerCase().trim().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ');
  
  // O(1) lookup in Map (faster than object property access)
  if (PRELOADED_RESPONSES_MAP.has(normalized)) {
    return PRELOADED_RESPONSES_MAP.get(normalized);
  }
  
  // Check partial matches (optimized loop - breaks on first match)
  for (const { key, response } of PARTIAL_MATCHES) {
    if (normalized.startsWith(key)) {
      const maxLength = key.length > 15 ? key.length + 20 : key.length + 10;
      if (normalized.length <= maxLength) {
        return response;
      }
    }
  }
  
  // No match found - return null to proceed with AI
  return null;
}

/**
 * Check if user message indicates they want to end the conversation
 * @param {string} userMessage - The user's message text
 * @returns {boolean} - True if message indicates ending
 */
function isEndingPhrase(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return false;
  }
  
  // Normalize the message: lowercase, trim, remove punctuation, remove extra spaces
  const normalized = userMessage.toLowerCase().trim().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ');
  const noSpaceText = normalized.replace(/\s+/g, '');
  
  // Ending phrases - comprehensive list
  const endingPhrases = [
    'thank you', 'thankyou', 'thanks', 'thx',
    'thank you so much', 'thanks a lot', 'thank you very much',
    'no thanks', 'no thank you', 'no thankyou',
    'ok thanks', 'okay thanks', 'ok thank you', 'okay thank you',
    "i'm done", 'im done', 'all done', "that's all", 'thats all',
    'nothing more', 'no more questions', 'no further questions',
    "that's it", 'thats it', 'that is it',
    'goodbye', 'bye', 'bye bye', 'see you', 'see ya',
    'i am done', 'iam done', 'we are done', 'we\'re done',
    'nothing else', 'no more', 'that\'s enough', 'thats enough'
  ];
  
  // Check for exact matches
  if (endingPhrases.includes(normalized)) {
    return true;
  }
  
  // Check if message starts or ends with any ending phrase
  for (const phrase of endingPhrases) {
    const phraseNoSpace = phrase.replace(/\s+/g, '');
    
    // Check if message starts or ends with phrase
    if (normalized.startsWith(phrase) || normalized.endsWith(phrase)) {
      return true;
    }
    if (noSpaceText.startsWith(phraseNoSpace) || noSpaceText.endsWith(phraseNoSpace)) {
      return true;
    }
    
    // For short messages (1-4 words), check if phrase is contained
    const wordCount = normalized.split(/\s+/).length;
    if (wordCount <= 4 && (normalized.includes(phrase) || noSpaceText.includes(phraseNoSpace))) {
      return true;
    }
  }
  
  // Special check for "thank you" variations in short messages
  if (normalized.split(/\s+/).length <= 5) {
    const thankPatterns = ['thank', 'thanks', 'thankyou', 'thx'];
    const donePatterns = ['done', 'finished', 'complete'];
    const hasThank = thankPatterns.some(pattern => normalized.includes(pattern) || noSpaceText.includes(pattern));
    const hasDone = donePatterns.some(pattern => normalized.includes(pattern) || noSpaceText.includes(pattern));
    
    if (hasThank || hasDone) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// PII Redaction helper (simple pattern matching)
function redactPII(text, REDACT_PII) {
  if (!REDACT_PII || !text) return text;
  
  // Simple email pattern redaction
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  let redacted = text.replace(emailPattern, '[REDACTED]');
  
  // Phone number pattern (basic)
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  redacted = redacted.replace(phonePattern, '[REDACTED]');
  
  return redacted;
}

// Save accuracy record helper
async function saveAccuracyRecord(deps, sessionId, messageId, aiText, confidence, latencyMs, tokens, responseType, metadata = {}) {
  const { databases, databaseId, aiAccuracyCollectionId, REDACT_PII } = deps;
  
  if (!databases || !databaseId || !aiAccuracyCollectionId) {
    console.warn('⚠️  Appwrite not configured, cannot save accuracy record');
    return null;
  }
  
  // Prepare data outside try block so it's accessible in catch block for retry
  let truncatedText = aiText || '';
  if (truncatedText.length > 10000) {
    truncatedText = truncatedText.substring(0, 10000) + '...[truncated]';
  }
  truncatedText = redactPII(truncatedText, REDACT_PII);
  
  let metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || '{}');
  // Ensure metadata is a string and truncate to 255 chars (Appwrite requirement)
  if (typeof metadataStr !== 'string') {
    metadataStr = String(metadataStr);
  }
  if (metadataStr.length > 255) {
    metadataStr = metadataStr.substring(0, 252) + '...'; // 252 + 3 = 255 chars
  }
  
  try {
    // Build accuracy document with only required fields first
    const accuracyDoc = {
      sessionId: sessionId,
      aiText: truncatedText,
      confidence: confidence !== undefined && confidence !== null ? confidence : null,
      tokens: tokens !== undefined && tokens !== null ? tokens : null,
      latencyMs: latencyMs !== undefined && latencyMs !== null ? latencyMs : null,
      humanMark: null,
      evaluation: null,
      createdAt: new Date().toISOString(),
      metadata: metadataStr
    };
    
    if (responseType) {
      accuracyDoc.responseType = responseType;
    }
    if (messageId) {
      accuracyDoc.messageId = messageId;
    }
    
    Object.keys(accuracyDoc).forEach(key => {
      if (accuracyDoc[key] === null || accuracyDoc[key] === undefined) {
        delete accuracyDoc[key];
      }
    });
    
    const { ID } = require('node-appwrite');
    const result = await databases.createDocument(
      databaseId,
      aiAccuracyCollectionId,
      ID.unique(),
      accuracyDoc
    );
    
    console.log(`📊 Accuracy record saved: ${sessionId} (${responseType || 'ai'}, ${latencyMs}ms, conf: ${confidence})`);
    return result.$id;
  } catch (err) {
    console.warn(`⚠️  Failed to save accuracy record:`, err?.message || err);
    return null;
  }
}

// Helper: Notify agent if online
function notifyAgentIfOnline(io, agentSockets, agentId, payload) {
  const socketId = agentSockets.get(agentId);
  if (socketId) {
    io.to(socketId).emit('assignment', payload);
    console.log(`📤 Notified agent ${agentId} via socket ${socketId}:`, payload);
    return true;
  }
  return false;
}

// ============================================================================
// LIVE VISITOR TRACKING
// ============================================================================

// In-memory store for active visitors (Tawk.to-style tracking)
const liveVisitors = new Map();

// ============================================================================
// SOCKET.IO INITIALIZATION
// ============================================================================

/**
 * Initialize Socket.IO event handlers
 * @param {Object} dependencies - All required dependencies
 */
function initializeSocket(dependencies) {
  const {
    io,
    databases,
    databaseId,
    sessionsCollectionId,
    messagesCollectionId,
    aiAccuracyCollectionId,
    Query,
    geminiClientRef, // Mutable reference: { client, model, modelName }
    chatService,
    agentSockets,
    sessionAssignments,
    authorizeSocketToken,
    isUserInRole,
    ADMIN_SHARED_SECRET,
    REDACT_PII
  } = dependencies;
  
  // Socket.IO connection handler
  io.on('connection', (socket) => {
    console.log(`📱 Client connected: ${socket.id}`);
    
    // Handle admin/widget joining session room for real-time updates
    socket.on('join_session', (data) => {
      const { sessionId } = data || {};
      if (sessionId && typeof sessionId === 'string') {
        socket.join(sessionId);
        const room = io.sockets.adapter.rooms.get(sessionId);
        const roomSize = room ? room.size : 0;
        console.log(`📱 Socket ${socket.id} joined session room: ${sessionId} (${roomSize} socket(s) total)`);
        
        // Verify session exists in Appwrite (for debugging)
        if (roomSize === 1) {
          console.log(`   ✅ First socket joined session ${sessionId} - session is active`);
        } else {
          console.log(`   ✅ Additional socket joined session ${sessionId} - ${roomSize} total participants`);
        }
      } else {
        console.warn(`⚠️  Invalid join_session request from ${socket.id}:`, data);
      }
    });
    
    // Handle admin joining admin feed for live visitor updates
    socket.on('join_admin_feed', () => {
      socket.join('admin_feed');
      console.log(`👮 Admin socket ${socket.id} joined admin_feed room`);
      // Send current live visitors list immediately
      io.to(socket.id).emit('live_visitors_update', Array.from(liveVisitors.values()));
    });
    
    // Handle visitor join (tracked when widget connects)
    socket.on('visitor_join', (data) => {
      const visitorData = {
        ...data,
        socketId: socket.id,
        onlineAt: new Date().toISOString()
      };
      liveVisitors.set(socket.id, visitorData);
      console.log(`👤 Visitor joined: ${socket.id} on ${data.url || 'unknown page'}`);
      // Broadcast updated list to all admins
      io.to('admin_feed').emit('live_visitors_update', Array.from(liveVisitors.values()));
    });
    
    /**
     * SESSION CREATION - PATH 2: Admin clicks "Initiate Chat" in Live Visitors
     * Flow:
     * 1. Admin emits 'initiate_chat' with { socketId, message, agentId }
     * 2. Backend calls createSession() -> creates NEW sessionId in Appwrite
     * 3. Backend saves initial message to Appwrite
     * 4. Backend emits 'agent_initiated_chat' to visitor's socket with { sessionId, text, sender: 'bot' }
     * 5. Widget receives 'agent_initiated_chat' -> sets sessionId -> emits 'join_session'
     * 6. Widget connects to the SAME session that was created by admin
     * 
     * Important: This creates a NEW session. The widget should NOT call start_session after this.
     */
    socket.on('initiate_chat', async (data) => {
      const { targetSocketId, message, agentId } = data || {};
      
      if (!targetSocketId || !message) {
        socket.emit('error', { error: 'targetSocketId and message required' });
        return;
      }
      
      // Check if visitor exists
      const visitor = liveVisitors.get(targetSocketId);
      if (!visitor) {
        socket.emit('error', { error: 'Visitor not found or disconnected' });
        return;
      }
      
      // Check authentication (agent must be authenticated)
      const userId = socket.data.userId;
      let hasPermission = false;
      
      if (ADMIN_SHARED_SECRET) {
        hasPermission = true;
        console.log(`⚠️  DEV MODE: Skipping RBAC check for initiate_chat`);
      } else {
        hasPermission = await isUserInRole(userId, 'agent') || 
                        await isUserInRole(userId, 'admin') || 
                        await isUserInRole(userId, 'super_admin');
      }
      
      if (!hasPermission) {
        socket.emit('error', { error: 'Insufficient permissions: agent role required' });
        return;
      }
      
      console.log(`💬 Agent ${agentId || userId} initiating chat with visitor ${targetSocketId}`);
      console.log(`   🔄 Path 2: Admin-initiated session creation`);
      
      try {
        // 1. Create a new proactive session in the database
        console.log(`   📋 Creating new proactive session via chatService.createProactiveSession()...`);
        const newSessionId = await chatService.createProactiveSession(agentId || userId);
        
        console.log(`✅ Created session for proactive chat: ${newSessionId}`);
        
        // Also assign agent to session (updates status to 'agent_assigned' and stores in userMeta)
        try {
          await chatService.assignAgentToSession(newSessionId, agentId || userId);
          console.log(`✅ Assigned agent ${agentId || userId} to session ${newSessionId}`);
        } catch (assignErr) {
          console.warn(`⚠️  Failed to assign agent to session (non-critical):`, assignErr?.message || assignErr);
        }
        
        // 2. Save the initial message as 'agent' (per spec)
        const messageSaved = await chatService.saveMessageToAppwrite(
          newSessionId,
          'agent',
          message,
          { agentId: agentId || userId }
        );
        
        if (!messageSaved) {
          console.warn(`⚠️  Failed to save initial message, but continuing with chat initiation`);
        } else {
          console.log(`✅ Saved initial agent message to database for session ${newSessionId}`);
        }
        
        // 3. Emit agent_initiated_chat to the visitor's socket
        console.log(`📤 Emitting agent_initiated_chat to socket ${targetSocketId} with sessionId: ${newSessionId}`);
        console.log(`   📋 Session ${newSessionId} created in Appwrite and ready for widget connection`);
        io.to(targetSocketId).emit('agent_initiated_chat', {
          sessionId: newSessionId,
          text: message,
          agentId: agentId || userId
        });
        
        console.log(`✅ Proactive chat initiated: session ${newSessionId}, visitor ${targetSocketId}`);
        console.log(`   🔗 Widget should now connect to session ${newSessionId} via join_session`);
        
        // 4. Update the liveVisitors map status to 'chatting' and broadcast to admin
        if (visitor) {
          visitor.status = 'chatting';
          visitor.sessionId = newSessionId;
          liveVisitors.set(targetSocketId, visitor);
          io.to('admin_feed').emit('live_visitors_update', Array.from(liveVisitors.values()));
        }
        
        // Notify the agent that chat was initiated successfully
        socket.emit('chat_initiated', {
          success: true,
          sessionId: newSessionId,
          targetSocketId: targetSocketId
        });
        
        console.log(`📋 Session ${newSessionId} is now available in admin/sessions and ready for continued conversation`);
        
      } catch (err) {
        console.error(`❌ Error initiating proactive chat:`, err?.message || err);
        console.error(`   Error code: ${err?.code}, Error type: ${err?.type}`);
        console.error(`   Full error stack:`, err.stack || err);
        console.error(`   Full error object:`, JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        socket.emit('error', { error: err?.message || 'Failed to initiate chat' });
        socket.emit('chat_initiated', {
          success: false,
          error: err?.message || 'Failed to initiate chat',
          targetSocketId: targetSocketId
        });
      }
    });
    
    /**
     * SESSION CREATION - PATH 1: Visitor clicks "Start Chat" button
     * Flow:
     * 1. Widget calls start() -> generates sessionId -> emits 'start_session'
     * 2. Backend receives 'start_session' -> calls ensureSessionInAppwrite()
     * 3. Session is created in Appwrite with status 'active'
     * 4. Socket joins session room
     * 5. Welcome message is sent to visitor
     */
    socket.on('start_session', async (data) => {
      const sessionId = data?.sessionId || socket.id;
      const userMeta = data?.userMeta || {};
      
      console.log(`📝 start_session event received: sessionId=${sessionId}`);
      console.log(`   🔄 Path 1: Visitor-initiated session creation`);
      const sessionCreated = await chatService.ensureSessionInAppwrite(sessionId, userMeta);
      if (!sessionCreated) {
        console.error(`❌ CRITICAL: Failed to create session [${sessionId}] - session will not appear in admin panel!`);
      } else {
        console.log(`   ✅ Session ${sessionId} created via visitor start_session`);
      }
      
      socket.join(sessionId);
      
      const room = io.sockets.adapter.rooms.get(sessionId);
      const roomSize = room ? room.size : 0;
      console.log(`📱 Socket ${socket.id} joined session room: ${sessionId} (${roomSize} socket(s) total)`);
      
      const welcomeMsg = "Hi! I'm your AI chat assistant. Ask me any question related to VTU internyet portal and I will provide you quick response.";
      socket.emit('session_started', { sessionId });
      socket.emit('bot_message', { text: welcomeMsg, confidence: 1 });
      
      const welcomeStart = process.hrtime.bigint();
      console.log(`💾 Attempting to save welcome message to Appwrite...`);
      const welcomeSaveResult = await chatService.saveMessageToAppwrite(sessionId, 'bot', welcomeMsg, { confidence: 1 });
      const welcomeEnd = process.hrtime.bigint();
      const welcomeLatencyMs = Number(welcomeEnd - welcomeStart) / 1000000;
      if (!welcomeSaveResult) {
        console.error(`❌ CRITICAL: Failed to save welcome message [${sessionId}]`);
      } else {
        console.log(`✅ Welcome message saved successfully [${sessionId}]`);
      }
      
      await saveAccuracyRecord(
        { databases, databaseId, aiAccuracyCollectionId, REDACT_PII },
        sessionId,
        null,
        welcomeMsg,
        1,
        Math.round(welcomeLatencyMs),
        null,
        'stub',
        { model: 'system', type: 'welcome' }
      );
      
      console.log(`📝 Session started: ${sessionId} (socket: ${socket.id})`);
    });
    
    // Handle user messages - CRITICAL: Check for agent assignment before AI
    socket.on('user_message', async (data) => {
      try {
        const { sessionId, text } = data || {};
        
        if (!sessionId || typeof sessionId !== 'string') {
          console.warn(`❌ user_message: missing or invalid sessionId from ${socket.id}`);
          socket.emit('session_error', { error: 'Invalid session ID' });
          return;
        }
        
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          console.warn(`❌ user_message: missing or empty text from ${socket.id}`);
          socket.emit('session_error', { error: 'Message text is required' });
          return;
        }
        
        socket.join(sessionId);
        const trimmedText = text.trim();
        console.log(`💬 Message received [${sessionId}]: "${trimmedText.substring(0, 50)}${trimmedText.length > 50 ? '...' : ''}"`);
        
        // Check if conversation is concluded
        let conversationConcluded = false;
        if (databases && databaseId && sessionsCollectionId) {
          try {
            const session = await chatService.getSessionDoc(sessionId);
            if (session) {
              const userMeta = typeof session.userMeta === 'string' 
                ? JSON.parse(session.userMeta || '{}') 
                : (session.userMeta || {});
              conversationConcluded = userMeta.conversationConcluded === true;
            }
          } catch (err) {
            console.warn('Failed to check conversation concluded status:', err?.message || err);
          }
        }
        
        if (conversationConcluded) {
          console.log(`💾 Attempting to save user message to Appwrite...`);
          await chatService.saveMessageToAppwrite(sessionId, 'user', trimmedText);
          console.log(`⚠️  Conversation concluded for [${sessionId}], ignoring user message`);
          return;
        }
        
        // Handle conclusion option selections
        const trimmedLower = trimmedText.toLowerCase().trim();
        if (trimmedLower === 'thank you for helping' || trimmedLower === 'thankyou for helping' || 
            (trimmedLower.includes('thank you') && trimmedLower.includes('helping'))) {
          const finalMessage = 'All the queries are solved, thank you have a good day';
          await chatService.saveMessageToAppwrite(sessionId, 'user', trimmedText);
          await chatService.saveMessageToAppwrite(sessionId, 'bot', finalMessage);
          
          if (databases && databaseId && sessionsCollectionId) {
            try {
              const currentSession = await chatService.getSessionDoc(sessionId);
              if (currentSession) {
                const userMeta = typeof currentSession.userMeta === 'string' 
                  ? JSON.parse(currentSession.userMeta || '{}') 
                  : (currentSession.userMeta || {});
                userMeta.conversationConcluded = true;
                await databases.updateDocument(
                  databaseId,
                  sessionsCollectionId,
                  sessionId,
                  { userMeta: JSON.stringify(userMeta) }
                );
              }
            } catch (err) {
              console.warn('Failed to mark conversation as concluded:', err?.message || err);
            }
          }
          
          io.to(sessionId).emit('bot_message', { text: finalMessage, type: 'conclusion_final' });
          return;
        } else if (trimmedLower === 'want to ask more' || trimmedLower === 'continue conversation' ||
                   trimmedLower.includes('want to ask') || trimmedLower.includes('ask more')) {
          let isConcluded = conversationConcluded;
          if (databases && databaseId && sessionsCollectionId) {
            try {
              const currentSession = await chatService.getSessionDoc(sessionId);
              if (currentSession) {
                const userMeta = typeof currentSession.userMeta === 'string' 
                  ? JSON.parse(currentSession.userMeta || '{}') 
                  : (currentSession.userMeta || {});
                isConcluded = userMeta.conversationConcluded === true;
              }
            } catch (err) {
              console.warn('Failed to refresh conversation concluded status:', err?.message || err);
            }
          }
          
          if (isConcluded) {
            const newSessionMsg = 'This conversation has ended. Please click "Start Chat" to begin a new session.';
            await chatService.saveMessageToAppwrite(sessionId, 'user', trimmedText);
            await chatService.saveMessageToAppwrite(sessionId, 'bot', newSessionMsg);
            io.to(sessionId).emit('bot_message', { text: newSessionMsg, type: 'conclusion_final' });
            return;
          }
          
          await chatService.saveMessageToAppwrite(sessionId, 'user', trimmedText);
        } else {
          await chatService.saveMessageToAppwrite(sessionId, 'user', trimmedText);
        }
        
        console.log(`✅ User message saved successfully [${sessionId}]`);
        
        // Check if session has assigned agent or AI is paused
        const cachedAssignment = sessionAssignments.get(sessionId);
        let assignedAgent = cachedAssignment?.agentId || null;
        let aiPaused = cachedAssignment?.aiPaused || false;
        
        let session = null;
        
        if (!assignedAgent && !aiPaused && databases && databaseId && sessionsCollectionId) {
          try {
            session = await chatService.getSessionDoc(sessionId);
            if (session) {
              console.log(`🔍 Checking session ${sessionId} - Status: ${session.status}`);
              
              if (session.status === 'agent_assigned') {
                aiPaused = true;
              }
              
              if (session.assignedAgent) {
                assignedAgent = session.assignedAgent;
                aiPaused = true;
              }
              
              if (session.userMeta) {
                try {
                  const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta;
                  if (userMeta.assignedAgent) {
                    assignedAgent = userMeta.assignedAgent;
                    aiPaused = true;
                  }
                } catch (e) {
                  console.warn(`   ⚠️  Failed to parse userMeta:`, e?.message);
                }
              }
              
              if (assignedAgent || aiPaused || session.status === 'agent_assigned') {
                sessionAssignments.set(sessionId, { 
                  agentId: assignedAgent, 
                  aiPaused: aiPaused || session.status === 'agent_assigned' 
                });
              }
            }
          } catch (err) {
            console.warn(`⚠️  Failed to check session assignment:`, err?.message || err);
          }
        }
        
        if (session?.status === 'agent_assigned') {
          aiPaused = true;
        }
        
        console.log(`🔍 Final check - assignedAgent: ${assignedAgent}, aiPaused: ${aiPaused}, status: ${session?.status}`);
        
        // If agent is assigned or AI is paused, forward to agent and skip AI
        if (assignedAgent || aiPaused || session?.status === 'agent_assigned') {
          const agentToForward = assignedAgent || 'unknown';
          console.log(`🔄 AI paused for session ${sessionId} — forwarding to agent ${agentToForward}`);
          
          io.to(sessionId).emit('user_message', { 
            text: trimmedText, 
            sender: 'user', 
            ts: Date.now() 
          });
          
          if (assignedAgent) {
            const agentSocketId = agentSockets.get(assignedAgent);
            if (agentSocketId) {
              io.to(agentSocketId).emit('user_message_for_agent', {
                sessionId: sessionId,
                text: trimmedText,
                ts: Date.now()
              });
              console.log(`📤 Forwarded user message to agent ${assignedAgent} (socket: ${agentSocketId})`);
            } else {
              console.warn(`⚠️  Agent ${assignedAgent} is not online — message saved but not forwarded`);
            }
          }
          
          return;
        }
        
        // No agent assigned - proceed with AI flow
        console.log(`🤖 Processing with AI for session ${sessionId}`);
        
        // Check for preloaded responses
        const preloadedResponse = getPreloadedResponse(trimmedText);
        if (preloadedResponse) {
          io.to(sessionId).emit('bot_message', { text: preloadedResponse, confidence: 1 });
          
          const preloadedStart = process.hrtime.bigint();
          const preloadedEnd = process.hrtime.bigint();
          const preloadedLatencyMs = Number(preloadedEnd - preloadedStart) / 1000000;
          
          setImmediate(() => {
            chatService.saveMessageToAppwrite(sessionId, 'bot', preloadedResponse, { confidence: 1, preloaded: true }).catch(err => {
              console.warn(`⚠️  Failed to save preloaded response:`, err?.message);
            });
            
            saveAccuracyRecord(
              { databases, databaseId, aiAccuracyCollectionId, REDACT_PII },
              sessionId,
              null,
              preloadedResponse,
              1,
              Math.round(preloadedLatencyMs),
              null,
              'preloaded',
              { model: 'preloaded', reason: 'Common question/greeting' }
            ).catch(err => {
              console.warn(`⚠️  Failed to save preloaded accuracy:`, err?.message);
            });
            
            console.log(`⚡⚡ INSTANT preloaded response [${sessionId}]: "${trimmedText.substring(0, 30)}..." (${Math.round(preloadedLatencyMs)}ms)`);
          });
          
          return;
        }
        
        // Check for ending phrases
        if (isEndingPhrase(trimmedText)) {
          console.log(`🔍 Ending phrase detected: "${trimmedText}"`);
          try {
            const conclusionQuestion = 'Is there anything else that I can help?';
            await chatService.saveMessageToAppwrite(sessionId, 'bot', conclusionQuestion);
            io.to(sessionId).emit('bot_message', { 
              text: conclusionQuestion, 
              type: 'conclusion_question',
              options: [
                { text: 'Thank you for helping', value: 'thank_you' },
                { text: 'Want to ask more', value: 'continue' }
              ]
            });
            console.log(`✅ Conclusion question sent to [${sessionId}]`);
            return;
          } catch (err) {
            console.error(`❌ Error sending conclusion question to [${sessionId}]:`, err?.message || err);
          }
        }
        
        // Content filtering
        const userTextLower = trimmedText.toLowerCase();
        const adultKeywords = ['sex', 'sexual', 'porn', 'xxx', 'adult', '18+', 'nsfw', 'explicit', 'nude', 'naked', 'erotic'];
        const hasAdultContent = adultKeywords.some(keyword => userTextLower.includes(keyword));
        
        if (hasAdultContent) {
          const rejectionMsg = "I cannot discuss adult or inappropriate content. I can help with professional questions related to your specified area.";
          await chatService.saveMessageToAppwrite(sessionId, 'bot', rejectionMsg, { confidence: 1, filtered: true });
          io.to(sessionId).emit('bot_message', { text: rejectionMsg, confidence: 1 });
          console.log(`🚫 Filtered adult content request from session ${sessionId}`);
          return;
        }
        
        // If Gemini isn't configured, return stub
        if (!geminiClientRef.client || !geminiClientRef.model) {
          const stub = `🧪 Stub reply: received "${trimmedText}" — set GEMINI_API_KEY to enable real responses.`;
          const stubStart = process.hrtime.bigint();
          
          await chatService.saveMessageToAppwrite(sessionId, 'bot', stub, { confidence: 1 });
          
          const stubEnd = process.hrtime.bigint();
          const stubLatencyMs = Number(stubEnd - stubStart) / 1000000;
          
          await saveAccuracyRecord(
            { databases, databaseId, aiAccuracyCollectionId, REDACT_PII },
            sessionId,
            null,
            stub,
            1,
            Math.round(stubLatencyMs),
            null,
            'stub',
            { model: 'stub', reason: 'GEMINI_API_KEY not set' }
          );
          
          io.to(sessionId).emit('bot_message', { text: stub, confidence: 1 });
          console.log(`🤖 Stub reply sent to [${sessionId}]`);
          return;
        }
        
        // Start latency timer
        const latencyStart = process.hrtime.bigint();
        
        // Call Gemini AI
        try {
          // Ensure model is initialized
          if (!geminiClientRef.model && geminiClientRef.client) {
            const modelCandidates = [
              process.env.GEMINI_MODEL,
              'gemini-2.5-flash-lite',
              'gemini-2.0-flash',
              'gemini-1.5-flash',
              'gemini-1.5-pro',
              'gemini-pro'
            ].filter(Boolean);
            
            for (const candidate of modelCandidates) {
              try {
                geminiClientRef.model = geminiClientRef.client.getGenerativeModel({ model: candidate });
                geminiClientRef.modelName = candidate;
                break;
              } catch (modelErr) {
                continue;
              }
            }
          }
          
          if (!geminiClientRef.model) {
            throw new Error('No Gemini model available');
          }
          
          // Load conversation history from Appwrite
          let conversationHistory = [];
          if (databases && databaseId && messagesCollectionId) {
            try {
              let result;
              if (Query) {
                result = await databases.listDocuments(
                  databaseId,
                  messagesCollectionId,
                  [Query.equal('sessionId', sessionId), Query.orderAsc('createdAt')],
                  50
                );
              } else {
                const allResult = await databases.listDocuments(
                  databaseId,
                  messagesCollectionId,
                  undefined,
                  1000
                );
                const filtered = allResult.documents
                  .filter(doc => doc.sessionId === sessionId)
                  .sort((a, b) => {
                    const timeA = new Date(a.createdAt || a.timestamp || a.$createdAt || 0).getTime();
                    const timeB = new Date(b.createdAt || b.timestamp || b.$createdAt || 0).getTime();
                    return timeA - timeB;
                  })
                  .slice(-20);
                result = { documents: filtered, total: filtered.length };
              }
              
              conversationHistory = result.documents
                .map(doc => ({
                  sender: doc.sender,
                  text: doc.text,
                  ts: new Date(doc.createdAt || doc.timestamp || doc.$createdAt || Date.now()).getTime()
                }));
              console.log(`📚 Loaded ${conversationHistory.length} messages from conversation history for session ${sessionId}`);
            } catch (err) {
              console.warn('Appwrite history load failed:', err?.message || err);
            }
          }
          
          // Build conversation context
          let systemPrompt = `You are a professional AI Assistant for VTU internyet portal.`;
          
          systemPrompt += `

CRITICAL: You MUST use the previous conversation history provided below to understand context, remember what was discussed, and provide relevant responses based on the ongoing conversation. 
Always reference previous messages when relevant.

MANDATORY RESPONSE LENGTH RULE - THIS IS CRITICAL:
- EVERY response MUST be between 20-30 words EXACTLY
- Count your words before responding
- Maximum 2-3 short sentences ONLY
- NEVER exceed 30 words - if you do, your response is TOO LONG
- If you cannot answer in 20-30 words, provide a brief summary instead

CONTENT FILTERING - CRITICAL RULES:
- STRICTLY PROHIBITED: Adult content (18+), explicit sexual content, inappropriate material, violence, hate speech, or any content unsuitable for general audiences
- If user asks about adult/inappropriate content, respond: "I cannot discuss adult or inappropriate content. I can help with questions about VTU internyet portal and internships." (20-30 words)
- DO NOT engage with, explain, or provide any information about adult/inappropriate topics, even if asked indirectly

TOPIC RELEVANCE RULES:
- Focus on answering questions related to VTU internyet portal, internships, and related topics
- If user asks questions completely unrelated to VTU internyet portal, politely redirect: "I can help you with questions about VTU internyet portal. How can I assist you with that?" (20-30 words)
- Stay focused on VTU internyet portal topics

OTHER RULES:
- Be concise, clear, and professional
- ALWAYS consider the previous conversation when responding - maintain continuity and context
- NEVER repeat questions that have already been asked in this conversation - check the conversation history
- Be helpful, friendly, and solution-oriented
- Provide accurate information about VTU internyet portal and internships

REMEMBER: 20-30 words maximum for EVERY response. No exceptions. Always use previous conversation context. Never repeat questions already asked. Reject adult content and stay focused on VTU internyet portal topics.`;
          
          let conversationContext = systemPrompt + '\n\n';
          
          if (conversationHistory.length > 0) {
            conversationContext += '=== PREVIOUS CONVERSATION HISTORY ===\n';
            conversationHistory.forEach((msg) => {
              if (msg.sender === 'user') {
                conversationContext += `User: ${msg.text}\n`;
              } else if (msg.sender === 'bot' || msg.sender === 'agent') {
                conversationContext += `You (Assistant): ${msg.text}\n`;
              }
            });
            conversationContext += '=== END OF PREVIOUS CONVERSATION HISTORY ===\n\n';
            conversationContext += 'IMPORTANT: Use the conversation history above to understand context. Reference previous messages when relevant.\n\n';
          }
          
          conversationContext += `Current User Question: ${trimmedText}\n\nYour Response (20-30 words, based on conversation history and current question):`;
          
          let result;
          let response;
          let aiText;
          let accuracyMetadata = {
            model: geminiClientRef.modelName || 'unknown',
            modelVersion: geminiClientRef.modelName || 'unknown',
            promptLength: conversationContext.length
          };
          
          try {
            // Prefer streaming responses for lower latency
            let usedStreaming = false;
            aiText = '';
            
            if (typeof geminiClientRef.model.generateContentStream === 'function') {
              try {
                console.log(`🔄 Using streaming Gemini API for session ${sessionId}`);
                const streamResult = await geminiClientRef.model.generateContentStream(conversationContext);
                usedStreaming = true;
                
                for await (const chunk of streamResult.stream) {
                  let chunkText = '';
                  
                  try {
                    if (typeof chunk.text === 'function') {
                      chunkText = chunk.text() || '';
                    } else if (chunk.candidates && chunk.candidates.length > 0) {
                      chunkText = chunk.candidates
                        .map(c => (c.content?.parts || []).map(p => p.text || '').join(''))
                        .join('');
                    }
                  } catch (extractErr) {
                    console.warn('⚠️  Failed to extract text from streaming chunk:', extractErr?.message || extractErr);
                  }
                  
                  if (!chunkText) continue;
                  
                  aiText += chunkText;
                  io.to(sessionId).emit('bot_stream', { text: aiText });
                }
              } catch (streamErr) {
                console.warn('⚠️  Streaming call failed, falling back to non-streaming generateContent:', streamErr?.message || streamErr);
                usedStreaming = false;
                aiText = '';
              }
            }
            
            // Fallback to non-streaming if streaming is unavailable or failed
            if (!usedStreaming || !aiText) {
              result = await geminiClientRef.model.generateContent(conversationContext);
              response = await result.response;
              aiText = response.text() || 'Sorry, I could not produce an answer.';
            }
            
            // Enforce 20-30 word limit
            const words = aiText.trim().split(/\s+/);
            if (words.length > 30) {
              aiText = words.slice(0, 30).join(' ') + '...';
              console.log(`⚠️  AI response exceeded 30 words (${words.length} words), truncated to 30 words`);
            }
            
            // Calculate latency
            const latencyEnd = process.hrtime.bigint();
            const latencyMs = Number(latencyEnd - latencyStart) / 1000000;
            
            // Try to extract tokens from response
            let tokens = null;
            try {
              if (response && response.usageMetadata) {
                tokens = response.usageMetadata.totalTokenCount || null;
              }
            } catch (tokenErr) {
              // Tokens not available, ignore
            }
            
            // Save message
            await chatService.saveMessageToAppwrite(sessionId, 'bot', aiText, { confidence: 0.9 });
            
            // Save accuracy record
            await saveAccuracyRecord(
              { databases, databaseId, aiAccuracyCollectionId, REDACT_PII },
              sessionId,
              null,
              aiText,
              0.9,
              Math.round(latencyMs),
              tokens,
              'ai',
              {
                ...accuracyMetadata,
                aiRequestId: result?.response?.promptFeedback?.blockReason || null
              }
            );
          } catch (modelErr) {
            // Try fallback models
            if (modelErr?.status === 404 || modelErr?.message?.includes('404') || modelErr?.message?.includes('not found')) {
              console.warn(`⚠️  Model ${geminiClientRef.modelName || 'current'} not available, trying alternatives...`);
              
              const fallbackModels = [
                'gemini-2.5-flash-lite',
                'gemini-2.0-flash',
                'gemini-1.5-flash',
                'gemini-1.5-pro',
                'gemini-pro',
                'gemini-1.0-pro',
                'gemini-2.5-flash'
              ];
              let fallbackSuccess = false;
              
              for (const fallbackModel of fallbackModels) {
                if (geminiClientRef.modelName && fallbackModel === geminiClientRef.modelName) continue;
                
                try {
                  console.log(`🔄 Trying model: ${fallbackModel}`);
                  const fallbackGeminiModel = geminiClientRef.client.getGenerativeModel({ model: fallbackModel });
                  result = await fallbackGeminiModel.generateContent(conversationContext);
                  response = await result.response;
                  aiText = response.text() || 'Sorry, I could not produce an answer.';
                  
                  // Enforce 20-30 word limit
                  const words = aiText.trim().split(/\s+/);
                  if (words.length > 30) {
                    aiText = words.slice(0, 30).join(' ') + '...';
                  }
                  
                  if (aiText && aiText !== 'Sorry, I could not produce an answer.') {
                    geminiClientRef.model = fallbackGeminiModel;
                    geminiClientRef.modelName = fallbackModel;
                    console.log(`✅ Successfully used model: ${fallbackModel}`);
                    fallbackSuccess = true;
                    break;
                  }
                } catch (fallbackErr) {
                  continue;
                }
              }
              
              if (!fallbackSuccess) {
                throw new Error('All Gemini models returned 404');
              }
            } else {
              throw modelErr;
            }
          }
          
          io.to(sessionId).emit('bot_message', { text: aiText, confidence: 0.9 });
          console.log(`✅ Gemini reply sent to [${sessionId}]`);
        } catch (err) {
          console.error('❌ Gemini call error:', {
            message: err?.message,
            code: err?.code,
            status: err?.status
          });
          
          const latencyEnd = process.hrtime.bigint();
          const latencyMs = Number(latencyEnd - latencyStart) / 1000000;
          
          const fallbackMsg = 'AI temporarily unavailable; your message is recorded and an agent will follow up.';
          
          await chatService.saveMessageToAppwrite(sessionId, 'bot', fallbackMsg, { 
            confidence: 0, 
            error: err?.message
          });
          
          await saveAccuracyRecord(
            { databases, databaseId, aiAccuracyCollectionId, REDACT_PII },
            sessionId,
            null,
            fallbackMsg,
            0,
            Math.round(latencyMs),
            null,
            'fallback',
            {
              model: geminiClientRef.modelName || 'unknown',
              error: err?.message || 'Unknown error'
            }
          );
          
          io.to(sessionId).emit('bot_message', { text: fallbackMsg, confidence: 0 });
        }
      } catch (handlerErr) {
        console.error(`❌ Unhandled error in user_message handler:`, {
          message: handlerErr?.message,
          stack: handlerErr?.stack
        });
        
        const errorMsg = 'Sorry, I encountered an error processing your message. Please try again.';
        try {
          const errSessionId = data?.sessionId;
          if (errSessionId) {
            await chatService.saveMessageToAppwrite(errSessionId, 'bot', errorMsg, { confidence: 0, error: handlerErr?.message });
            io.to(errSessionId).emit('bot_message', { text: errorMsg, confidence: 0 });
          }
        } catch (saveErr) {
          console.error(`❌ Failed to save error message:`, saveErr?.message || saveErr);
        }
      }
    });
    
    // Agent authentication and connection
    socket.on('agent_auth', async (data) => {
      const { token, agentId } = data || {};
      if (!token) {
        socket.emit('auth_error', { error: 'Token required' });
        setTimeout(() => socket.disconnect(), 1000);
        return;
      }
      
      try {
        const authResult = await authorizeSocketToken(token);
        if (!authResult || !authResult.userId) {
          socket.emit('auth_error', { error: 'Invalid token' });
          setTimeout(() => socket.disconnect(), 1000);
          return;
        }
        
        const userId = authResult.userId;
        const hasAgentRole = await isUserInRole(userId, 'agent');
        
        if (!hasAgentRole) {
          socket.emit('auth_error', { error: 'Insufficient permissions: agent role required' });
          setTimeout(() => socket.disconnect(), 1000);
          return;
        }
        
        const finalAgentId = agentId || userId;
        agentSockets.set(finalAgentId, socket.id);
        socket.join(`agents:${finalAgentId}`);
        socket.data.authenticated = true;
        socket.data.userId = userId;
        socket.data.agentId = finalAgentId;
        
        console.log(`👤 Agent authenticated and connected: ${finalAgentId} (user: ${userId}, socket: ${socket.id})`);
        socket.emit('agent_connected', { agentId: finalAgentId, userId });
      } catch (err) {
        console.error('Error authenticating agent:', err);
        socket.emit('auth_error', { error: 'Authentication failed' });
        setTimeout(() => socket.disconnect(), 1000);
      }
    });
    
    // Legacy agent_connect (for backward compatibility)
    socket.on('agent_connect', async (data) => {
      const { agentId, token } = data || {};
      
      if (token) {
        socket.emit('agent_auth', { token, agentId });
        return;
      }
      
      // DEV MODE: Allow agent_connect without full auth if ADMIN_SHARED_SECRET is set
      if (!socket.data.authenticated && ADMIN_SHARED_SECRET) {
        console.log(`⚠️  DEV MODE: Allowing agent_connect without full auth for agentId: ${agentId}`);
        const finalAgentId = agentId || 'dev-agent';
        agentSockets.set(finalAgentId, socket.id);
        socket.join(`agents:${finalAgentId}`);
        socket.data.authenticated = true;
        socket.data.userId = finalAgentId;
        socket.data.agentId = finalAgentId;
        console.log(`👤 Agent connected (DEV MODE): ${finalAgentId} (socket: ${socket.id})`);
        socket.emit('agent_connected', { agentId: finalAgentId });
        return;
      }
      
      if (!socket.data.authenticated) {
        socket.emit('error', { error: 'Authentication required. Send agent_auth event first.' });
        return;
      }
      
      const finalAgentId = agentId || socket.data.agentId || socket.data.userId;
      if (!finalAgentId) {
        socket.emit('error', { error: 'agentId required' });
        return;
      }
      
      agentSockets.set(finalAgentId, socket.id);
      socket.join(`agents:${finalAgentId}`);
      console.log(`👤 Agent connected: ${finalAgentId} (socket: ${socket.id})`);
      socket.emit('agent_connected', { agentId: finalAgentId });
    });
    
    // Agent takeover handler (requires agent role)
    socket.on('agent_takeover', async (data) => {
      const { sessionId, agentId } = data || {};
      if (!sessionId || !agentId) {
        socket.emit('error', { error: 'sessionId and agentId required' });
        return;
      }
      
      // DEV MODE: Allow agent_takeover without full auth if ADMIN_SHARED_SECRET is set
      if (!socket.data.authenticated && ADMIN_SHARED_SECRET) {
        console.log(`⚠️  DEV MODE: Allowing agent_takeover without full auth for agentId: ${agentId}`);
        socket.data.authenticated = true;
        socket.data.userId = agentId;
        socket.data.agentId = agentId;
      }
      
      if (!socket.data.authenticated) {
        socket.emit('error', { error: 'Authentication required' });
        return;
      }
      
      const userId = socket.data.userId;
      let hasPermission = false;
      
      if (ADMIN_SHARED_SECRET) {
        hasPermission = true;
        console.log(`⚠️  DEV MODE: Skipping RBAC check for agent_takeover`);
      } else {
        hasPermission = await isUserInRole(userId, 'agent') || 
                        await isUserInRole(userId, 'admin') || 
                        await isUserInRole(userId, 'super_admin');
      }
      
      if (!hasPermission) {
        socket.emit('error', { error: 'Insufficient permissions: agent role required' });
        return;
      }
      
      try {
        await chatService.assignAgentToSession(sessionId, agentId);
        socket.join(sessionId);
        
        io.to(sessionId).emit('agent_joined', { agentId, sessionId });
        console.log(`👤 Agent ${agentId} took over session ${sessionId}`);
        
        notifyAgentIfOnline(io, agentSockets, agentId, { type: 'assignment', sessionId });
        socket.emit('agent_takeover_success', { sessionId, agentId });
      } catch (err) {
        console.error(`❌ Failed to assign agent:`, err?.message || err);
        socket.emit('error', { error: 'Failed to assign agent', details: err?.message });
      }
    });
    
    // Agent message handler
    socket.on('agent_message', async (data) => {
      const { sessionId, text, agentId } = data || {};
      if (!sessionId || !text || !agentId) {
        socket.emit('error', { error: 'sessionId, text, and agentId required' });
        return;
      }
      
      // DEV MODE: Allow agent messages without full auth if ADMIN_SHARED_SECRET is set
      if (!socket.data.authenticated && ADMIN_SHARED_SECRET) {
        console.log(`⚠️  DEV MODE: Allowing agent_message without full auth for agentId: ${agentId}`);
        socket.data.authenticated = true;
        socket.data.userId = agentId;
        socket.data.agentId = agentId;
      }
      
      if (!socket.data.authenticated) {
        socket.emit('error', { error: 'Authentication required' });
        return;
      }
      
      const userId = socket.data.userId;
      let hasPermission = false;
      
      if (ADMIN_SHARED_SECRET) {
        hasPermission = true;
        console.log(`⚠️  DEV MODE: Skipping RBAC check for agent message`);
      } else {
        hasPermission = await isUserInRole(userId, 'agent') || 
                        await isUserInRole(userId, 'admin') || 
                        await isUserInRole(userId, 'super_admin');
      }
      
      if (!hasPermission) {
        socket.emit('error', { error: 'Insufficient permissions: agent role required' });
        return;
      }
      
      console.log(`✅ Agent message accepted: agentId=${agentId}, sessionId=${sessionId}`);
      
      let saveSuccess = false;
      try {
        saveSuccess = await chatService.saveMessageToAppwrite(sessionId, 'agent', text, { agentId });
        if (saveSuccess) {
          console.log(`✅ Agent message saved to Appwrite: ${sessionId} (agent: ${agentId})`);
        }
      } catch (saveErr) {
        console.error(`❌ Exception saving agent message to Appwrite:`, saveErr?.message || saveErr);
      }
      
      const messagePayload = { 
        text, 
        agentId, 
        sender: 'agent', 
        ts: Date.now(),
        sessionId
      };
      
      io.to(sessionId).emit('agent_message', messagePayload);
      io.to(sessionId).emit('message', messagePayload);
      
      const room = io.sockets.adapter.rooms.get(sessionId);
      const roomSize = room ? room.size : 0;
      console.log(`👤 Agent ${agentId} sent message to session ${sessionId} (${roomSize} socket(s) in room)`);
      
      socket.emit('agent_message_sent', { sessionId, success: true, saved: saveSuccess });
    });
    
    // Handle internal notes (private agent messages, not visible to users)
    socket.on('internal_note', async (data) => {
      const { sessionId, text, agentId } = data || {};
      if (!sessionId || !text || !agentId) {
        socket.emit('error', { error: 'sessionId, text, and agentId required' });
        return;
      }
      
      // DEV MODE: Allow internal notes without full auth if ADMIN_SHARED_SECRET is set
      if (!socket.data.authenticated && ADMIN_SHARED_SECRET) {
        console.log(`⚠️  DEV MODE: Allowing internal_note without full auth for agentId: ${agentId}`);
        socket.data.authenticated = true;
        socket.data.userId = agentId;
        socket.data.agentId = agentId;
      }
      
      if (!socket.data.authenticated) {
        socket.emit('error', { error: 'Authentication required' });
        return;
      }
      
      const userId = socket.data.userId;
      let hasPermission = false;
      
      if (ADMIN_SHARED_SECRET) {
        hasPermission = true;
        console.log(`⚠️  DEV MODE: Skipping RBAC check for internal note`);
      } else {
        hasPermission = await isUserInRole(userId, 'agent') || 
                        await isUserInRole(userId, 'admin') || 
                        await isUserInRole(userId, 'super_admin');
      }
      
      if (!hasPermission) {
        socket.emit('error', { error: 'Insufficient permissions: agent role required' });
        return;
      }
      
      console.log(`🔒 Internal note accepted: agentId=${agentId}, sessionId=${sessionId}`);
      
      // Save with visibility: 'internal' flag
      let saveSuccess = false;
      try {
        saveSuccess = await chatService.saveMessageToAppwrite(sessionId, 'internal', text, { agentId }, 'internal');
        if (saveSuccess) {
          console.log(`✅ Internal note saved to Appwrite: ${sessionId} (agent: ${agentId})`);
        }
      } catch (saveErr) {
        console.error(`❌ Exception saving internal note to Appwrite:`, saveErr?.message || saveErr);
      }
      
      const messagePayload = { 
        text, 
        agentId, 
        sender: 'internal', 
        ts: Date.now(),
        sessionId
      };
      
      // CRITICAL: Only emit to session room (agents), DO NOT emit standard 'message' event
      // This ensures internal notes are NOT visible to user widgets
      io.to(sessionId).emit('internal_note', messagePayload);
      
      const room = io.sockets.adapter.rooms.get(sessionId);
      const roomSize = room ? room.size : 0;
      console.log(`🔒 Internal note sent to session ${sessionId} (${roomSize} socket(s) in room - agents only)`);
      
      socket.emit('internal_note_sent', { sessionId, success: true, saved: saveSuccess });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      // Remove from live visitors if exists
      if (liveVisitors.has(socket.id)) {
        liveVisitors.delete(socket.id);
        console.log(`👤 Visitor disconnected: ${socket.id}`);
        // Broadcast updated list to all admins
        io.to('admin_feed').emit('live_visitors_update', Array.from(liveVisitors.values()));
      }
      
      for (const [agentId, socketId] of agentSockets.entries()) {
        if (socketId === socket.id) {
          agentSockets.delete(agentId);
          console.log(`👤 Agent ${agentId} disconnected`);
          break;
        }
      }
      console.log(`📱 Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initializeSocket };

