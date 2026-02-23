/**
 * Socket Handler - Socket.IO Event Loop
 * 
 * Handles all real-time communication events.
 */

const {
  awDatabases,
  Query,
  resend,
  geminiClient,
  geminiModel,
  geminiModelName,
  chatService,
  config
} = require('../config/clients');
const llmService = require('../services/llm/llmService');
const settingsService = require('../services/settingsService');
const responseService = require('../services/chat/responseService');

const {
  APPWRITE_DATABASE_ID,
  APPWRITE_SESSIONS_COLLECTION_ID,
  APPWRITE_MESSAGES_COLLECTION_ID,
  APPWRITE_AI_ACCURACY_COLLECTION_ID,
  APPWRITE_USERS_COLLECTION_ID,
  APPWRITE_NOTIFICATIONS_COLLECTION_ID,
  ADMIN_SHARED_SECRET,
  REDACT_PII
} = config;

const {
  agentSockets,
  sessionAssignments
} = require('../config/state');

const {
  authorizeSocketToken,
  isUserInRole
} = require('../controllers/authController');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isEndingPhrase(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return false;
  const normalized = userMessage.toLowerCase().trim();
  return ['bye', 'goodbye', 'thank you', 'thanks'].some(p => normalized.includes(p));
}

function detectHumanAgentIntent(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return false;
  const normalized = userMessage.toLowerCase().trim();
  return ['agent', 'human', 'support person'].some(k => normalized.includes(k)) &&
    ['talk', 'speak', 'connect', 'want', 'need'].some(a => normalized.includes(a));
}

// In-memory store for active visitors
const liveVisitors = new Map();

// Helper: Notify agent if online
function notifyAgentIfOnline(io, agentId, payload) {
  const socketId = agentSockets.get(agentId);
  if (socketId) {
    io.to(socketId).emit('assignment', payload);
    return true;
  }
  return false;
}

// Save accuracy record helper
async function saveAccuracyRecord(sessionId, messageId, aiText, confidence, latencyMs, tokens, responseType, metadata = {}) {
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) return null;

  let truncatedText = aiText || '';
  if (truncatedText.length > 10000) truncatedText = truncatedText.substring(0, 10000) + '...';

  try {
    const { ID } = require('node-appwrite');
    const doc = {
      sessionId,
      aiText: truncatedText,
      confidence: confidence ?? null,
      latencyMs: latencyMs ?? null,
      metadata: JSON.stringify(metadata).substring(0, 255),
      createdAt: new Date().toISOString()
    };
    if (responseType) doc.responseType = responseType;
    if (messageId) doc.messageId = messageId;

    // Clean undefined/nulls
    Object.keys(doc).forEach(key => doc[key] === null && delete doc[key]);

    return await awDatabases.createDocument(APPWRITE_DATABASE_ID, APPWRITE_AI_ACCURACY_COLLECTION_ID, ID.unique(), doc);
  } catch (err) {
    console.warn('Failed to save accuracy record:', err.message);
    return null;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

module.exports = function (io) {
  // Initialize response service cache on startup
  responseService.loadResponses().catch(err => {
    console.error('Failed to load response cache on startup:', err);
  });

  // Socket.IO connection handler
  io.on('connection', (socket) => {
    console.log(`📱 Client connected: ${socket.id}`);

    socket.on('join_session', (data) => {
      const { sessionId } = data || {};
      if (sessionId) {
        socket.join(sessionId);
        console.log(`📱 Socket ${socket.id} joined session room: ${sessionId}`);
      }
    });

    socket.on('join_admin_feed', () => {
      socket.join('admin_feed');
      io.to(socket.id).emit('live_visitors_update', Array.from(liveVisitors.values()));
    });

    socket.on('typing_start', (data) => {
      const { sessionId, user } = data || {};
      if (sessionId) socket.to(sessionId).emit('display_typing', { user, isTyping: true });
    });

    socket.on('typing_stop', (data) => {
      const { sessionId, user } = data || {};
      if (sessionId) socket.to(sessionId).emit('display_typing', { user, isTyping: false });
    });

    socket.on('request_agent', async (data) => {
      const { sessionId } = data || {};
      if (!sessionId) return;

      const msg = "An agent has been requested. A representative will join shortly.";
      await chatService.saveMessageToAppwrite(sessionId, 'bot', msg, { type: 'agent_request_confirmation' });
      io.to(sessionId).emit('bot_message', { text: msg, type: 'agent_request_confirmation' });

      // Create notification
      if (awDatabases && APPWRITE_DATABASE_ID) {
        try {
          const { ID } = require('node-appwrite');
          const notif = {
            type: 'request_agent',
            content: `Session ${sessionId} requested an agent`,
            sessionId,
            isRead: false
          };
          await awDatabases.createDocument(APPWRITE_DATABASE_ID, APPWRITE_NOTIFICATIONS_COLLECTION_ID || 'notifications', ID.unique(), notif);
          io.to('admin').emit('new_notification', notif);
          io.to('admin_feed').emit('new_notification', notif); // Also emit to admin_feed for AudioNotifications
        } catch (e) { console.error('Error creating notification:', e); }
      }
    });

    socket.on('visitor_join', (data) => {
      const visitorData = { ...data, socketId: socket.id, onlineAt: new Date().toISOString() };
      liveVisitors.set(socket.id, visitorData);
      io.to('admin_feed').emit('live_visitors_update', Array.from(liveVisitors.values()));
    });

    socket.on('initiate_chat', async (data) => {
      const { targetSocketId, message, agentId } = data;
      console.log('🚀 initiate_chat received:', { targetSocketId, agentId });

      if (!targetSocketId || !message) {
        socket.emit('chat_initiated', { success: false, error: 'Missing targetSocketId or message' });
        return;
      }

      try {
        // 1. Create a new Session ID
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Get visitor info for metadata
        const visitor = liveVisitors.get(targetSocketId);
        const agentIdToAssign = agentId || 'admin';

        const userMeta = visitor ? {
          name: 'Visitor', // Default name
          assignedAgent: agentIdToAssign, // CRITICAL: Marks this session as assigned so AI doesn't reply
          metadata: JSON.stringify({
            url: visitor.url,
            title: visitor.title,
            referrer: visitor.referrer,
            userAgent: visitor.userAgent
          })
        } : {
          assignedAgent: agentIdToAssign
        };

        // 2. Ensure session exists in Appwrite
        await chatService.ensureSessionInAppwrite(sessionId, userMeta);

        // 2a. Update local cache immediately so subsequent user messages are caught even before DB sync
        sessionAssignments.set(sessionId, { agentId: agentIdToAssign, aiPaused: true });

        // 3. Save the initial message (from agent)
        await chatService.saveMessageToAppwrite(sessionId, 'agent', message, {
          agentId: agentIdToAssign,
          type: 'text'
        });

        // 4. Emit to the specific visitor (Widget)
        // The widget expects 'agent_initiated_chat'
        io.to(targetSocketId).emit('agent_initiated_chat', {
          sessionId,
          text: message,
          sender: 'agent', // Display as agent message
          agentId: agentIdToAssign
        });

        // 5. Respond success to Admin
        socket.emit('chat_initiated', {
          success: true,
          sessionId
        });

        // 6. Join the admin to this session room so they get updates
        socket.join(sessionId);

        // 7. Update visitor status in live list
        if (visitor) {
          visitor.status = 'chatting';
          visitor.sessionId = sessionId;
          liveVisitors.set(targetSocketId, visitor);
          io.to('admin_feed').emit('live_visitors_update', Array.from(liveVisitors.values()));
        }

        console.log(`✅ Chat initiated successfully: ${sessionId} (Agent: ${agentIdToAssign})`);

      } catch (error) {
        console.error('❌ Error in initiate_chat:', error);
        socket.emit('chat_initiated', { success: false, error: error.message || 'Internal Server Error' });
      }
    });

    socket.on('start_session', async (data) => {
      const sessionId = data?.sessionId || socket.id;
      const sessionCreated = await chatService.ensureSessionInAppwrite(sessionId, data?.userMeta || {});

      socket.join(sessionId);

      // Fetch dynamic welcome message with fail-safe fallback
      let welcomeMsg = "Hi! I'm your AI Assistant. How can I help you today?"; // Hardcoded Fallback
      try {
        welcomeMsg = await settingsService.getWelcomeMessage();
      } catch (error) {
        console.error("Failed to fetch welcome message, using default:", error);
      }

      socket.emit('session_started', { sessionId });
      io.to('admin_feed').emit('session_started', { sessionId });
      socket.emit('bot_message', { text: welcomeMsg });

      await chatService.saveMessageToAppwrite(sessionId, 'bot', welcomeMsg);
    });

    // User Message Handler
    socket.on('end_session', async (data) => {
      const { sessionId } = data || {};
      if (sessionId) {
        console.log(`🛑 Client requested end_session: ${sessionId}`);

        // Fetch current AI provider info
        const providerInfo = await llmService.getCurrentProviderInfo();
        const providerName = providerInfo.name || 'AI';
        const resolutionText = `Solved by AI (${providerName})`;

        // Use dedicated resolution method to handle complex userMeta updates
        await chatService.setSessionResolution(sessionId, resolutionText);

        // Notify any agents or admin feed monitoring this session
        io.to('admin_feed').emit('session_updated', {
          sessionId,
          status: 'closed',
          assignedAgent: resolutionText
        });
      }
    });

    socket.on('user_message', async (data) => {
      const { sessionId, text, type, attachmentUrl } = data;
      if (!sessionId || (!text && !attachmentUrl)) return;

      // 1. Save user message with attachment info if present
      const metadata = {};
      if (type) metadata.type = type;
      if (attachmentUrl) metadata.attachmentUrl = attachmentUrl;

      await chatService.saveMessageToAppwrite(sessionId, 'user', text || 'Image', metadata);

      // Broadcast to admins watching
      socket.to(sessionId).emit('new_message', {
        sessionId,
        text: text || 'Image',
        sender: 'user',
        createdAt: new Date().toISOString(),
        type: type || undefined,
        attachmentUrl: attachmentUrl || undefined
      });

      // Also emit user_message_for_agent with attachment info
      socket.to(sessionId).emit('user_message_for_agent', {
        sessionId,
        text: text || 'Image',
        ts: Date.now(),
        type: type || undefined,
        attachmentUrl: attachmentUrl || undefined
      });

      // 2. Check assignments (Check DB first for truth)
      // assignments might be cached, but best to trust DB if critical
      const sessionDoc = await chatService.getSessionDoc(sessionId);
      let isAssigned = false;

      if (sessionDoc) {
        // Check userMeta for assignedAgent
        try {
          const meta = typeof sessionDoc.userMeta === 'string' ? JSON.parse(sessionDoc.userMeta || '{}') : sessionDoc.userMeta;
          if (meta?.assignedAgent) isAssigned = true;
        } catch (e) { }

        // Also check direct fields if they exist
        if (sessionDoc.assignedAgent || sessionDoc.status === 'agent_assigned') isAssigned = true;
      }

      if (isAssigned) {
        // AI Paused
        return;
      }

      // Fallback to cache if DB check failed or valid
      const assignment = sessionAssignments.get(sessionId);
      if (assignment) {
        // If assigned, default to AI paused unless explicitly enabled?
        // For now, if assigned, we assume agent handles it.
        // And definitely if aiPaused is true.
        if (assignment.aiPaused !== false) {
          console.log(`⏸️  AI paused for session ${sessionId} (Assigned to ${assignment.agentId})`);
          return;
        }
      }

      // 3. Check for Ending Phrase (Thank You loop)
      // Special handler for "Yes, ask more" - resumption flow
      if (text.toLowerCase().trim() === 'yes, ask more') {
        const msg = "yes, how i can help you !!!";
        await chatService.saveMessageToAppwrite(sessionId, 'bot', msg);
        io.to(sessionId).emit('bot_message', { text: msg });
        return;
      }

      // Special handler for "No, close conversation" - termination flow
      // Prevent AI from replying to this message, as frontend handles the closing UI
      if (text.toLowerCase().trim() === 'no, close conversation') {
        console.log(`🔇 Creating silence for specific closing phrase: "${text}"`);
        return;
      }

      if (isEndingPhrase(text)) {
        const msg = "You're welcome! Is there anything else I can help you with?";
        const options = [
          { text: "Yes, ask more", value: "continue" },
          { text: "No, close conversation", value: "thank_you" }
        ];

        await chatService.saveMessageToAppwrite(sessionId, 'bot', msg, {
          type: 'conclusion_question',
          options: options
        });

        io.to(sessionId).emit('bot_message', {
          text: msg,
          type: 'conclusion_question',
          options: options
        });

        return;
      }

      // 4. Human Agent Intent Detection
      if (detectHumanAgentIntent(text)) {
        const msg = "I can connect you with a human agent.";
        await chatService.saveMessageToAppwrite(sessionId, 'bot', msg);
        io.to(sessionId).emit('bot_message', {
          text: msg,
          showAgentButton: true // Signal frontend to show the button
        });
        return;
      }

      // 5. Check Bot Auto-Replies (from dynamic responseService)
      const autoReply = responseService.findMatch(text);
      if (autoReply) {
        const startTime = Date.now();
        await new Promise(r => setTimeout(r, 600)); // Latency sim
        const latency = Date.now() - startTime;

        await chatService.saveMessageToAppwrite(sessionId, 'bot', autoReply, {
          type: 'auto_reply',
          confidence: 1.0 // Auto-replies are exact matches = 100% confident
        });

        // Track in ai_accuracy collection for dashboard
        await saveAccuracyRecord(
          sessionId,
          null, // messageId
          autoReply,
          1.0, // confidence
          latency,
          null, // tokens
          'auto_reply',
          { source: 'responseService' }
        );

        io.to(sessionId).emit('bot_message', {
          text: autoReply,
          confidence: 1.0
        });
        return;
      }

      // 6. LLM Response (Modular)
      try {
        const { generateResponse } = require('../services/llm/llmService');

        // Dynamic Context Memory
        const contextLimit = await settingsService.getContextLimit();

        // Fetch recent history
        const historyDocs = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_MESSAGES_COLLECTION_ID,
          [
            Query.equal('sessionId', sessionId),
            Query.orderDesc('createdAt'),
            Query.limit(contextLimit)
          ]
        );

        // Map to standard format and reverse (oldest first)
        // 'user' -> 'user'
        // 'bot'/'agent' -> 'assistant'
        const messages = historyDocs.documents.reverse().map(doc => ({
          role: doc.sender === 'user' ? 'user' : 'assistant',
          content: doc.text || ''
        }));

        // Fallback if history fetch failed or empty (race condition)
        if (messages.length === 0) {
          messages.push({ role: 'user', content: text });
        }

        const startTime = Date.now();

        // Vision Support: Pass attachmentUrl if present
        // generateResponse now returns { text, suggestions } — destructure here
        const llmResult = attachmentUrl
          ? await generateResponse(messages, attachmentUrl)
          : await generateResponse(messages);

        const responseText = llmResult.text;
        const suggestions = llmResult.suggestions || [];

        const latency = Date.now() - startTime;

        // Default confidence for LLM responses (can be made dynamic later)
        const confidence = 0.75;

        await chatService.saveMessageToAppwrite(sessionId, 'bot', responseText, {
          confidence: confidence
        });

        // Track in ai_accuracy collection for dashboard
        await saveAccuracyRecord(
          sessionId,
          null, // messageId
          responseText,
          confidence,
          latency,
          null, // tokens (can be extracted from LLM response if available)
          'llm_response',
          { contextLimit: contextLimit }
        );

        io.to(sessionId).emit('bot_message', {
          text: responseText,
          confidence: confidence,
          suggestions: suggestions  // Dynamic quick-reply suggestions from LLM
        });
      } catch (e) {
        console.error('LLM Generation error:', e);
        const errRes = "I'm experiencing technical difficulties. Please try again in a moment, or request a human agent for immediate assistance.";

        // Error responses have 0 confidence (will trigger offline form in widget)
        await chatService.saveMessageToAppwrite(sessionId, 'bot', errRes, {
          confidence: 0.0
        });

        // Track error in ai_accuracy collection for dashboard
        await saveAccuracyRecord(
          sessionId,
          null, // messageId
          errRes,
          0.0, // confidence = 0 for errors
          0, // latency
          null, // tokens
          'error',
          { error: e.message || 'Unknown error' }
        );

        io.to(sessionId).emit('bot_message', {
          text: errRes,
          confidence: 0.0
        });
      }
    });

    // Agent Auth
    socket.on('agent_auth', async (data) => {
      const { token } = data;
      const user = await authorizeSocketToken(token);
      if (user) {
        socket.data.user = user;
        socket.join('admin'); // General admin room
        agentSockets.set(user.userId, socket.id);
        socket.emit('auth_success', { user });
      } else {
        socket.emit('auth_error', { message: 'Invalid token' });
      }

    });

    // Agent Message Handler
    socket.on('agent_message', async (data, callback) => {
      const { sessionId, text, agentId, type, attachmentUrl } = data;
      if (!sessionId || !text) {
        if (typeof callback === 'function') callback({ status: 'error', error: 'Missing sessionId or text' });
        return;
      }

      console.log(`💬 Agent message in ${sessionId}: ${text.substring(0, 50)}...`);

      // 1. Save to Appwrite
      await chatService.saveMessageToAppwrite(sessionId, 'agent', text, {
        agentId,
        type: type || 'text',
        attachmentUrl
      });

      // 2. Broadcast to User (and other agents watching)
      io.to(sessionId).emit('agent_message', {
        sessionId,
        text,
        sender: 'agent',
        agentId,
        type: type || 'text',
        attachmentUrl,
        createdAt: new Date().toISOString()
      });

      // 3. Acknowledgement Callback
      if (typeof callback === 'function') {
        callback({ status: 'ok' });
      }
    });

    // Internal Note Handler
    socket.on('internal_note', async (data, callback) => {
      const { sessionId, text, agentId } = data;
      if (!sessionId || !text) {
        if (typeof callback === 'function') callback({ status: 'error', error: 'Missing sessionId or text' });
        return;
      }

      // 1. Save as internal
      await chatService.saveMessageToAppwrite(sessionId, 'internal', text, { agentId }, 'internal');

      // 2. Broadcast ONLY to admins/agents (not to the user room generally, but admin feed or specific socket)
      // Since agents join the session room, we need a special event that the widget IGNORES
      io.to(sessionId).emit('internal_note', {
        sessionId,
        text,
        sender: 'internal',
        agentId,
        createdAt: new Date().toISOString()
      });

      // 3. Acknowledgement Callback
      if (typeof callback === 'function') {
        callback({ status: 'ok' });
      }
    });

    socket.on('disconnect', () => {
      liveVisitors.delete(socket.id);
      io.to('admin_feed').emit('live_visitors_update', Array.from(liveVisitors.values()));
      // Cleanup agent socket if applicable
      if (socket.data.user) {
        agentSockets.delete(socket.data.user.userId);
      }
      console.log(`📱 Client disconnected: ${socket.id}`);
    });
  });
};
