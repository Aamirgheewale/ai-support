require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const archiver = require('archiver');
const { stringify } = require('csv-stringify');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Appwrite client initialization
let awClient = null;
let awDatabases = null;
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPWRITE_SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION_ID;
const APPWRITE_MESSAGES_COLLECTION_ID = process.env.APPWRITE_MESSAGES_COLLECTION_ID;

// Import Query at module level for use in queries
let Query = null;
if (APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID && APPWRITE_API_KEY) {
  try {
    const { Client, Databases } = require('node-appwrite');
    Query = require('node-appwrite').Query;
    awClient = new Client();
    awClient.setEndpoint(APPWRITE_ENDPOINT);
    awClient.setProject(APPWRITE_PROJECT_ID);
    awClient.setKey(APPWRITE_API_KEY);
    awDatabases = new Databases(awClient);
    console.log('✅ Appwrite client initialized');
    
    // Log configuration status
    console.log('📋 Appwrite Configuration:');
    console.log(`   Endpoint: ${APPWRITE_ENDPOINT}`);
    console.log(`   Project ID: ${APPWRITE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Database ID: ${APPWRITE_DATABASE_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Sessions Collection: ${APPWRITE_SESSIONS_COLLECTION_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Messages Collection: ${APPWRITE_MESSAGES_COLLECTION_ID ? '✅ Set' : '❌ Missing'}`);
    
    if (!APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
      console.warn('⚠️  Messages will NOT be saved until APPWRITE_DATABASE_ID and APPWRITE_MESSAGES_COLLECTION_ID are set');
    }
  } catch (e) {
    console.warn('⚠️  node-appwrite not available — Appwrite features disabled:', e?.message || e);
  }
} else {
  console.log('ℹ️  Appwrite env vars not set — Appwrite features disabled');
  console.log('   Required: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
}

// Gemini client — using @google/generative-ai SDK
let geminiClient = null;
let geminiModel = null;
let geminiModelName = null;

try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  if (process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const preferredModel = process.env.GEMINI_MODEL;
    // Use models that work with free tier (gemini-2.0-flash or gemini-1.5-flash)
    const modelCandidates = preferredModel 
      ? [preferredModel]
      : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    geminiModelName = modelCandidates[0];
    geminiModel = geminiClient.getGenerativeModel({ model: geminiModelName });
    console.log(`✅ Gemini client initialized (model: ${geminiModelName} - will fallback if unavailable)`);
  } else {
    console.warn('⚠️  GEMINI_API_KEY missing — running in stub mode');
  }
} catch (e) {
  console.warn('⚠️  @google/generative-ai package not available — running in stub mode:', e?.message || e);
}

// In-memory agent socket mapping (replaces Redis)
const agentSockets = new Map(); // agentId -> socketId

// In-memory session assignment cache (for fast lookups)
const sessionAssignments = new Map(); // sessionId -> { agentId, aiPaused }

// Admin authentication middleware
const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.substring(7);
  if (token !== ADMIN_SHARED_SECRET) {
    return res.status(403).json({ error: 'Invalid admin token' });
  }
  next();
}

// Appwrite helper: Ensure session exists
async function ensureSessionInAppwrite(sessionId, userMeta = {}) {
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
    return;
  }
  
  try {
    const now = new Date().toISOString();
    const sessionDoc = {
      sessionId: sessionId,
      status: 'active',
      lastSeen: now,
      startTime: now,
      userMeta: typeof userMeta === 'object' ? JSON.stringify(userMeta) : userMeta,
      theme: '{}'
    };
    
    await awDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_SESSIONS_COLLECTION_ID,
      sessionId,
      sessionDoc
    );
    console.log(`✅ Created session in Appwrite: ${sessionId}`);
  } catch (err) {
    if (err.code === 409) {
      // Session exists, update lastSeen only (don't overwrite userMeta to preserve assignedAgent)
      try {
        await awDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_SESSIONS_COLLECTION_ID,
          sessionId,
          {
            lastSeen: new Date().toISOString()
            // Don't update userMeta here - it might contain assignedAgent info
          }
        );
        console.log(`✅ Updated session lastSeen in Appwrite: ${sessionId}`);
      } catch (updateErr) {
        console.warn(`⚠️  Failed to update session ${sessionId}:`, updateErr?.message || updateErr);
      }
    } else {
      console.warn(`⚠️  Failed to ensure session ${sessionId}:`, err?.message || err);
    }
  }
}

// Appwrite helper: Get session document
async function getSessionDoc(sessionId) {
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
    return null;
  }
  
  try {
    const doc = await awDatabases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_SESSIONS_COLLECTION_ID,
      sessionId
    );
    return doc;
  } catch (err) {
    if (err.code === 404) {
      return null;
    }
    console.warn(`⚠️  Failed to get session ${sessionId}:`, err?.message || err);
    return null;
  }
}

// Appwrite helper: Save message
async function saveMessageToAppwrite(sessionId, sender, text, metadata = {}) {
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
    if (!APPWRITE_DATABASE_ID) {
      console.warn(`⚠️  Cannot save message: APPWRITE_DATABASE_ID is not set in .env`);
    } else if (!APPWRITE_MESSAGES_COLLECTION_ID) {
      console.warn(`⚠️  Cannot save message: APPWRITE_MESSAGES_COLLECTION_ID is not set in .env`);
    } else if (!awDatabases) {
      console.warn(`⚠️  Cannot save message: Appwrite client not initialized`);
    }
    return false;
  }
  
  try {
    // Ensure session exists before saving message
    await ensureSessionInAppwrite(sessionId);
    
    const now = new Date().toISOString();
    const messageDoc = {
      sessionId: sessionId,
      sender: sender,
      text: text,
      createdAt: now,
      metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata,
      confidence: metadata.confidence || null
    };
    
    const result = await awDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_MESSAGES_COLLECTION_ID,
      'unique()',
      messageDoc
    );
    console.log(`✅ Saved message to Appwrite: ${sessionId} (${sender}) [Doc ID: ${result.$id}]`);
    return true;
  } catch (err) {
    const errorDetails = {
      message: err?.message || 'Unknown error',
      code: err?.code,
      type: err?.type,
      response: err?.response
    };
    
    console.error(`❌ Failed to save message to Appwrite [${sessionId}]:`, errorDetails);
    
    // Provide helpful error messages
    if (err?.code === 404) {
      console.error(`   💡 Collection or Database not found. Check:`);
      console.error(`      - APPWRITE_DATABASE_ID: ${APPWRITE_DATABASE_ID ? '✅ Set' : '❌ Missing'}`);
      console.error(`      - APPWRITE_MESSAGES_COLLECTION_ID: ${APPWRITE_MESSAGES_COLLECTION_ID ? '✅ Set' : '❌ Missing'}`);
      console.error(`      - Verify IDs in Appwrite Console → Databases`);
    } else if (err?.code === 401) {
      console.error(`   💡 Authentication failed - API Key Missing Scopes`);
      console.error(`   🔧 Fix: Go to Appwrite Console → Settings → API Keys`);
      console.error(`      Edit your API key and enable these scopes:`);
      console.error(`      - databases.read, databases.write`);
      console.error(`      - collections.read, collections.write`);
      console.error(`      - documents.read, documents.write`);
      console.error(`   See FIX_API_KEY_SCOPES.md for detailed instructions`);
    } else if (err?.code === 403) {
      console.error(`   💡 Permission denied. Check API key has write access to database`);
      console.error(`   🔧 Fix: Update API key scopes in Appwrite Console`);
    } else if (err?.code === 400) {
      console.error(`   💡 Bad request. Check collection attributes match:`);
      console.error(`      Required: sessionId (string), sender (string), text (string), createdAt (datetime), metadata (string), confidence (double)`);
      if (err?.message?.includes('createdAt')) {
        console.error(`   🔧 Fix: Add createdAt attribute to messages collection in Appwrite Console`);
      }
    }
    
    return false;
  }
}

// Appwrite helper: Mark session needs human
async function markSessionNeedsHuman(sessionId, reason) {
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
    return;
  }
  
  try {
    await awDatabases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_SESSIONS_COLLECTION_ID,
      sessionId,
      {
        status: 'needs_help',
        lastSeen: new Date().toISOString()
      }
    );
    console.log(`✅ Marked session ${sessionId} as needing help`);
  } catch (err) {
    console.warn(`⚠️  Failed to mark session needs help:`, err?.message || err);
  }
}

// Appwrite helper: Assign agent to session
async function assignAgentToSession(sessionId, agentId) {
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
    console.warn(`⚠️  Appwrite not configured - cannot assign agent`);
    return;
  }
  
  try {
    // Get current session to preserve userMeta
    const session = await getSessionDoc(sessionId);
    if (!session) {
      // Session doesn't exist, create it first
      await ensureSessionInAppwrite(sessionId);
      const newSession = await getSessionDoc(sessionId);
      if (!newSession) {
        throw new Error(`Failed to create session ${sessionId}`);
      }
    }
    
    // Parse userMeta
    const userMeta = typeof session?.userMeta === 'string' 
      ? JSON.parse(session.userMeta || '{}') 
      : (session?.userMeta || {});
    
    // Store agent info in userMeta (works with any collection schema)
    userMeta.assignedAgent = agentId;
    userMeta.aiPaused = true;
    
    // Try updating with assignedAgent/aiPaused fields first
    const updateDoc = {
      status: 'agent_assigned',
      lastSeen: new Date().toISOString(),
      userMeta: JSON.stringify(userMeta)
    };
    
    // Try adding assignedAgent and aiPaused if collection supports them
    try {
      updateDoc.assignedAgent = agentId;
      updateDoc.aiPaused = true;
    } catch (e) {
      // Ignore - fields might not exist
    }
    
    try {
      await awDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        sessionId,
        updateDoc
      );
        console.log(`✅ Assigned agent ${agentId} to session ${sessionId} (AI paused)`);
        // Cache in memory for fast lookup
        sessionAssignments.set(sessionId, { agentId, aiPaused: true });
    } catch (updateErr) {
      // If update fails due to unknown fields, remove them and retry
      if (updateErr?.code === 400 || updateErr?.message?.includes('Unknown attribute') || updateErr?.message?.includes('Invalid document structure')) {
        console.log(`⚠️  assignedAgent/aiPaused fields not in collection, using userMeta only`);
        
        // Retry without assignedAgent/aiPaused fields
        await awDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_SESSIONS_COLLECTION_ID,
          sessionId,
          {
            status: 'agent_assigned',
            lastSeen: new Date().toISOString(),
            userMeta: JSON.stringify(userMeta)
          }
        );
        console.log(`✅ Assigned agent ${agentId} to session ${sessionId} (stored in userMeta, AI paused)`);
        // Cache in memory for fast lookup
        sessionAssignments.set(sessionId, { agentId, aiPaused: true });
      } else {
        // Re-throw if it's a different error
        throw updateErr;
      }
    }
  } catch (err) {
    console.error(`❌ Failed to assign agent to session:`, err?.message || err);
    console.error(`   Error code: ${err?.code}, Type: ${err?.type}`);
    throw err;
  }
}

// Helper: Notify agent if online
function notifyAgentIfOnline(agentId, payload) {
  const socketId = agentSockets.get(agentId);
  if (socketId) {
    io.to(socketId).emit('assignment', payload);
    console.log(`📤 Notified agent ${agentId} via socket ${socketId}:`, payload);
    return true;
  }
  return false;
}

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`📱 Client connected: ${socket.id}`);

  // Handle session start
  socket.on('start_session', async (data) => {
    const sessionId = data?.sessionId || socket.id;
    const userMeta = data?.userMeta || {};
    
    await ensureSessionInAppwrite(sessionId, userMeta);
    socket.join(sessionId);
    
    const welcomeMsg = "Hello! 👋 I'm your AI Customer Support Assistant. How can I help you today?";
    socket.emit('session_started', { sessionId });
    socket.emit('bot_message', { text: welcomeMsg, confidence: 1 });
    
    await saveMessageToAppwrite(sessionId, 'bot', welcomeMsg, { confidence: 1 });
    console.log(`📝 Session started: ${sessionId} (socket: ${socket.id})`);
  });

  // Handle user messages - CRITICAL: Check for agent assignment before AI
  socket.on('user_message', async (data) => {
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

    // Always save user message to Appwrite
    await saveMessageToAppwrite(sessionId, 'user', trimmedText);

    // Check if session has assigned agent or AI is paused
    // First check in-memory cache (fastest)
    const cachedAssignment = sessionAssignments.get(sessionId);
    let assignedAgent = cachedAssignment?.agentId || null;
    let aiPaused = cachedAssignment?.aiPaused || false;
    
    let session = null;
    
    // If not in cache, check Appwrite
    if (!assignedAgent && !aiPaused && awDatabases && APPWRITE_DATABASE_ID && APPWRITE_SESSIONS_COLLECTION_ID) {
      try {
        session = await getSessionDoc(sessionId);
        if (session) {
          console.log(`🔍 Checking session ${sessionId} - Status: ${session.status}`);
          
          // Check status first - if agent_assigned, definitely has agent
          if (session.status === 'agent_assigned') {
            console.log(`   ✅ Session status is 'agent_assigned'`);
            aiPaused = true;
          }
          
          // Check for assignedAgent field directly
          if (session.assignedAgent) {
            assignedAgent = session.assignedAgent;
            aiPaused = session.aiPaused === true || session.aiPaused === 'true' || true;
            console.log(`   ✅ Found in direct fields - assignedAgent: ${assignedAgent}, aiPaused: ${aiPaused}`);
          }
          
          // Always check userMeta
          if (session.userMeta) {
            try {
              const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta;
              console.log(`   userMeta keys:`, Object.keys(userMeta).join(', '));
              
              if (userMeta.assignedAgent) {
                assignedAgent = userMeta.assignedAgent;
                aiPaused = userMeta.aiPaused === true || userMeta.aiPaused === 'true' || true;
                console.log(`   ✅ Found agent in userMeta: ${assignedAgent}, aiPaused: ${aiPaused}`);
              }
            } catch (e) {
              console.warn(`   ⚠️  Failed to parse userMeta:`, e?.message);
            }
          }
          
          // Cache the result for next time
          if (assignedAgent || aiPaused || session.status === 'agent_assigned') {
            sessionAssignments.set(sessionId, { 
              agentId: assignedAgent, 
              aiPaused: aiPaused || session.status === 'agent_assigned' 
            });
          }
        } else {
          console.log(`   ⚠️  Session ${sessionId} not found in Appwrite`);
        }
      } catch (err) {
        console.warn(`⚠️  Failed to check session assignment:`, err?.message || err);
      }
    } else if (cachedAssignment) {
      console.log(`🔍 Using cached assignment - assignedAgent: ${assignedAgent}, aiPaused: ${aiPaused}`);
    }

    // Final check: if status is agent_assigned, ensure AI is paused
    if (session?.status === 'agent_assigned') {
      aiPaused = true;
    }

    console.log(`🔍 Final check - assignedAgent: ${assignedAgent}, aiPaused: ${aiPaused}, status: ${session?.status}`);

    // If agent is assigned or AI is paused, forward to agent and skip AI
    if (assignedAgent || aiPaused || session?.status === 'agent_assigned') {
      const agentToForward = assignedAgent || 'unknown';
      console.log(`🔄 AI paused for session ${sessionId} — forwarding to agent ${agentToForward}`);
      
      // Emit to session room so widget shows the message
      io.to(sessionId).emit('user_message', { 
        text: trimmedText, 
        sender: 'user', 
        ts: Date.now() 
      });
      
      // Forward to agent socket if online and we have agentId
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
      } else {
        console.warn(`⚠️  Session ${sessionId} has agent_assigned status but no agentId found — AI paused but message not forwarded`);
      }
      
      // DO NOT invoke AI - return early
      return;
    }

    // No agent assigned - proceed with AI flow
    console.log(`🤖 Processing with AI for session ${sessionId}`);

    // If Gemini isn't configured, return stub
    if (!geminiClient || !geminiModel) {
      const stub = `🧪 Stub reply: received "${trimmedText}" — set GEMINI_API_KEY to enable real responses.`;
      await saveMessageToAppwrite(sessionId, 'bot', stub, { confidence: 1 });
      io.to(sessionId).emit('bot_message', { text: stub, confidence: 1 });
      console.log(`🤖 Stub reply sent to [${sessionId}]`);
      return;
    }

    // Call Gemini AI
    try {
      // Ensure model is initialized
      if (!geminiModel && geminiClient) {
        const modelCandidates = [
          process.env.GEMINI_MODEL,
          'gemini-2.0-flash',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
          'gemini-pro'
        ].filter(Boolean);
        
        for (const candidate of modelCandidates) {
          try {
            geminiModel = geminiClient.getGenerativeModel({ model: candidate });
            geminiModelName = candidate;
            break;
          } catch (modelErr) {
            continue;
          }
        }
      }
      
      if (!geminiModel) {
        throw new Error('No Gemini model available');
      }

      // Load conversation history from Appwrite
      let conversationHistory = [];
      if (awDatabases && APPWRITE_DATABASE_ID && APPWRITE_MESSAGES_COLLECTION_ID) {
        try {
          const result = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_MESSAGES_COLLECTION_ID,
            [`equal("sessionId", "${sessionId}")`],
            10
          );
          conversationHistory = result.documents
            .sort((a, b) => {
              const timeA = new Date(a.createdAt || a.timestamp || a.$createdAt || 0).getTime();
              const timeB = new Date(b.createdAt || b.timestamp || b.$createdAt || 0).getTime();
              return timeA - timeB;
            })
            .slice(-10)
            .map(doc => ({
              sender: doc.sender,
              text: doc.text,
              ts: new Date(doc.createdAt || doc.timestamp || doc.$createdAt || Date.now()).getTime()
            }));
        } catch (err) {
          console.warn('Appwrite history load failed:', err?.message || err);
        }
      }
      
      // Build conversation context
      const systemPrompt = `You are a professional AI Customer Support Assistant. Your role is to:
- Provide helpful, friendly, and empathetic customer support
- Answer questions clearly and concisely
- Escalate complex issues when necessary
- Maintain a professional yet warm tone
- Focus on solving customer problems efficiently

Always be polite, patient, and solution-oriented. If you cannot resolve an issue, offer to connect the customer with a human agent.`;
      
      let conversationContext = systemPrompt + '\n\n';
      
      if (conversationHistory.length > 0) {
        conversationContext += 'Previous conversation:\n';
        conversationHistory.forEach(msg => {
          if (msg.sender === 'user') {
            conversationContext += `Customer: ${msg.text}\n`;
          } else if (msg.sender === 'bot' || msg.sender === 'agent') {
            conversationContext += `Assistant: ${msg.text}\n`;
          }
        });
        conversationContext += '\n';
      }
      
      conversationContext += `Customer: ${trimmedText}\nAssistant:`;
      
      let result;
      let response;
      let aiText;
      
      try {
        result = await geminiModel.generateContent(conversationContext);
        response = await result.response;
        aiText = response.text() || 'Sorry, I could not produce an answer.';
      } catch (modelErr) {
        // Try fallback models
        if (modelErr?.status === 404 || modelErr?.message?.includes('404') || modelErr?.message?.includes('not found')) {
          console.warn(`⚠️  Model ${geminiModelName || 'current'} not available, trying alternatives...`);
          
          const fallbackModels = [
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-pro',
            'gemini-1.0-pro',
            'gemini-2.5-flash'
          ];
          let fallbackSuccess = false;
          
          for (const fallbackModel of fallbackModels) {
            if (geminiModelName && fallbackModel === geminiModelName) continue;
            
            try {
              console.log(`🔄 Trying model: ${fallbackModel}`);
              const fallbackGeminiModel = geminiClient.getGenerativeModel({ model: fallbackModel });
              result = await fallbackGeminiModel.generateContent(conversationContext);
              response = await result.response;
              aiText = response.text() || 'Sorry, I could not produce an answer.';
              
              if (aiText && aiText !== 'Sorry, I could not produce an answer.') {
                geminiModel = fallbackGeminiModel;
                geminiModelName = fallbackModel;
                console.log(`✅ Successfully used model: ${fallbackModel}`);
                fallbackSuccess = true;
                break;
              }
            } catch (fallbackErr) {
              if (!fallbackErr?.message?.includes('404') && !fallbackErr?.message?.includes('not found')) {
                console.warn(`⚠️  Model ${fallbackModel} error:`, fallbackErr?.message?.substring(0, 100));
              }
              continue;
            }
          }
          
          if (!fallbackSuccess) {
            const errorDetails = {
              message: 'All Gemini models returned 404. Your API key may not have access to these models.',
              suggestion: '1. Verify your GEMINI_API_KEY is correct\n2. Check API key permissions in Google Cloud Console\n3. Try getting a new API key from https://aistudio.google.com/app/apikey\n4. Set GEMINI_MODEL to a specific model name from Google AI Studio'
            };
            console.error('❌', errorDetails.message);
            console.log('💡', errorDetails.suggestion);
            throw new Error(errorDetails.message);
          }
        } else {
          throw modelErr;
        }
      }

      await saveMessageToAppwrite(sessionId, 'bot', aiText, { confidence: 0.9 });
      io.to(sessionId).emit('bot_message', { text: aiText, confidence: 0.9 });
      console.log(`✅ Gemini reply sent to [${sessionId}]`);
    } catch (err) {
      console.error('❌ Gemini call error:', {
        message: err?.message,
        code: err?.code,
        status: err?.status
      });
      
      const isRateLimit = err?.status === 429 || err?.message?.includes('429') || err?.code === 429;
      if (isRateLimit) {
        await markSessionNeedsHuman(sessionId, 'Rate limit exceeded');
      }
      
      const fallbackMsg = 'AI temporarily unavailable; your message is recorded and an agent will follow up.';
      io.to(sessionId).emit('bot_message', { text: fallbackMsg, confidence: 0 });
      await saveMessageToAppwrite(sessionId, 'bot', fallbackMsg, { confidence: 0, error: err?.message });
    }
  });

  // Agent connect handler
  socket.on('agent_connect', async (data) => {
    const { agentId } = data || {};
    if (!agentId) {
      socket.emit('error', { error: 'agentId required' });
      return;
    }
    
    agentSockets.set(agentId, socket.id);
    socket.join(`agents:${agentId}`);
    console.log(`👤 Agent connected: ${agentId} (socket: ${socket.id})`);
    socket.emit('agent_connected', { agentId });
  });

  // Agent takeover handler
  socket.on('agent_takeover', async (data) => {
    const { sessionId, agentId } = data || {};
    if (!sessionId || !agentId) {
      socket.emit('error', { error: 'sessionId and agentId required' });
      return;
    }
    
    try {
      await assignAgentToSession(sessionId, agentId);
      socket.join(sessionId);
      io.to(sessionId).emit('agent_joined', { agentId });
      console.log(`👤 Agent ${agentId} took over session ${sessionId}`);
      
      // Notify agent socket if online
      notifyAgentIfOnline(agentId, { type: 'assignment', sessionId });
      socket.emit('agent_takeover_success', { sessionId, agentId });
    } catch (err) {
      console.error(`❌ Failed to assign agent:`, err?.message || err);
      console.error(`   Error details:`, err);
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
    
    await saveMessageToAppwrite(sessionId, 'agent', text, { agentId });
    io.to(sessionId).emit('agent_message', { text, agentId, sender: 'agent', ts: Date.now() });
    console.log(`👤 Agent ${agentId} sent message to session ${sessionId}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    // Clean up agent mapping
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

// Admin REST endpoints

// GET /admin/sessions - List sessions
app.get('/admin/sessions', requireAdminAuth, async (req, res) => {
  try {
    const { status, limit = 50, search } = req.query;
    
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
      return res.json({ sessions: [], message: 'Appwrite not configured' });
    }
    
    let queries = [];
    if (status && status.trim() !== '' && Query) {
      queries.push(Query.equal('status', status));
      console.log(`🔍 Filtering sessions by status: "${status}"`);
    }
    if (search && search.trim() !== '' && Query) {
      queries.push(Query.equal('sessionId', search));
      console.log(`🔍 Filtering sessions by search: "${search}"`);
    }
    
    console.log(`📋 Fetching sessions with ${queries.length} query filter(s)`);
    
    let result;
    try {
      result = await awDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        queries.length > 0 ? queries : undefined,
        parseInt(limit)
      );
      console.log(`✅ Backend returned ${result.total} total session(s), ${result.documents.length} in this page`);
    } catch (queryErr) {
      console.error(`❌ Query error:`, queryErr?.message || queryErr);
      // If query fails, try fetching all and filtering client-side
      console.log(`⚠️  Falling back to fetch-all-then-filter approach`);
      result = await awDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        undefined,
        parseInt(limit) * 10 // Fetch more to ensure we get filtered results
      );
      console.log(`✅ Fetched ${result.total} session(s) for client-side filtering`);
    }
    
    // Transform sessions to extract assignedAgent from userMeta if needed
    let transformedSessions = result.documents.map((doc) => {
      let assignedAgent = doc.assignedAgent || null;
      
      // If assignedAgent field doesn't exist, try to get it from userMeta
      if (!assignedAgent && doc.userMeta) {
        try {
          const userMeta = typeof doc.userMeta === 'string' ? JSON.parse(doc.userMeta) : doc.userMeta;
          if (userMeta && userMeta.assignedAgent) {
            assignedAgent = userMeta.assignedAgent;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      return {
        ...doc,
        assignedAgent: assignedAgent
      };
    });
    
    // If query failed and we fetched all, filter client-side on backend
    if (status && status.trim() !== '' && queries.length > 0) {
      const beforeFilter = transformedSessions.length;
      transformedSessions = transformedSessions.filter(s => s.status === status);
      console.log(`🔍 Backend client-side filter: ${beforeFilter} → ${transformedSessions.length} sessions with status="${status}"`);
    }
    
    console.log(`📤 Sending ${transformedSessions.length} session(s) to frontend`);
    res.json({ sessions: transformedSessions });
  } catch (err) {
    console.error('Error listing sessions:', err);
    res.status(500).json({ error: err?.message || 'Failed to list sessions' });
  }
});

// GET /admin/sessions/:sessionId/messages - List messages for a session
app.get('/admin/sessions/:sessionId/messages', requireAdminAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
      return res.json({ messages: [], message: 'Appwrite not configured' });
    }
    
    console.log(`📨 Fetching messages for session: ${sessionId}`);
    
    let result;
    
    // Try Query class first if available
    if (Query) {
      try {
        console.log(`🔍 Using Query class for messages query`);
        result = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_MESSAGES_COLLECTION_ID,
          [Query.equal('sessionId', sessionId)],
          1000
        );
        console.log(`✅ Found ${result.total} message(s) for session ${sessionId} using Query class`);
      } catch (queryErr) {
        console.error(`❌ Query class failed:`, queryErr?.message || queryErr);
        // Fall through to fallback
      }
    }
    
    // Fallback: fetch all messages and filter client-side
    if (!result) {
      try {
        console.log(`⚠️  Fetching all messages and filtering client-side...`);
        const allResult = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_MESSAGES_COLLECTION_ID,
          undefined, // No query - fetch all
          10000 // Large limit to get all messages
        );
        
        // Filter client-side by sessionId
        const filteredDocs = allResult.documents.filter(doc => doc.sessionId === sessionId);
        result = {
          documents: filteredDocs,
          total: filteredDocs.length
        };
        console.log(`✅ Found ${result.total} message(s) for session ${sessionId} using client-side filtering (from ${allResult.total} total messages)`);
      } catch (fallbackErr) {
        console.error(`❌ Failed to fetch messages:`, fallbackErr?.message || fallbackErr);
        console.error(`   Error code:`, fallbackErr?.code);
        console.error(`   Error type:`, fallbackErr?.type);
        throw new Error(`Failed to fetch messages: ${fallbackErr?.message || fallbackErr}`);
      }
    }
    
    // Sort by createdAt ascending (oldest first) - includes all sender types: user, bot, agent
    const sortedMessages = result.documents.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.$createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.$createdAt || 0).getTime();
      return timeA - timeB;
    });
    
    // Log message types for debugging
    const messageTypes = sortedMessages.reduce((acc, msg) => {
      acc[msg.sender || 'unknown'] = (acc[msg.sender || 'unknown'] || 0) + 1;
      return acc;
    }, {});
    console.log(`📊 Message types:`, messageTypes);
    
    res.json({ messages: sortedMessages });
  } catch (err) {
    console.error('Error listing messages:', err);
    res.status(500).json({ error: err?.message || 'Failed to list messages' });
  }
});

// POST /admin/sessions/:sessionId/assign - Assign session to agent
app.post('/admin/sessions/:sessionId/assign', requireAdminAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId required' });
    }
    
    await assignAgentToSession(sessionId, agentId);
    notifyAgentIfOnline(agentId, { type: 'assignment', sessionId });
    io.to(sessionId).emit('agent_joined', { agentId });
    
    res.json({ success: true, sessionId, agentId });
  } catch (err) {
    console.error('Error assigning session:', err);
    res.status(500).json({ error: err?.message || 'Failed to assign session' });
  }
});

// POST /admin/sessions/:sessionId/close - Close conversation
app.post('/admin/sessions/:sessionId/close', requireAdminAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
      return res.status(500).json({ error: 'Appwrite not configured' });
    }
    
    // Update session status to closed
    await awDatabases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_SESSIONS_COLLECTION_ID,
      sessionId,
      {
        status: 'closed',
        lastSeen: new Date().toISOString()
      }
    );
    
    // Clear from in-memory assignment cache
    sessionAssignments.delete(sessionId);
    
    // Notify all connected clients
    io.to(sessionId).emit('conversation_closed', { sessionId });
    console.log(`✅ Closed conversation: ${sessionId}`);
    
    res.json({ success: true, sessionId, status: 'closed' });
  } catch (err) {
    console.error('Error closing session:', err);
    res.status(500).json({ error: err?.message || 'Failed to close session' });
  }
});

// GET /admin/assignments - List sessions needing human
app.get('/admin/assignments', requireAdminAuth, async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
      return res.json({ sessions: [], message: 'Appwrite not configured' });
    }
    
    const result = await awDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_SESSIONS_COLLECTION_ID,
      [`equal("status", "needs_help")`],
      100
    );
    
    res.json({ sessions: result.documents });
  } catch (err) {
    console.error('Error listing assignments:', err);
    res.status(500).json({ error: err?.message || 'Failed to list assignments' });
  }
});

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

// Simple in-memory rate limiter (TODO: Replace with Redis/Upstash for production)
const exportRateLimiter = new Map(); // token -> { count, resetTime }
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 exports per minute

function checkRateLimit(token) {
  const now = Date.now();
  const limit = exportRateLimiter.get(token);
  
  if (!limit || now > limit.resetTime) {
    exportRateLimiter.set(token, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Audit logging helper
function logExportAction(adminId, sessionIds, format) {
  const timestamp = new Date().toISOString();
  console.log(`📤 [EXPORT] Admin: ${adminId}, Sessions: ${sessionIds.join(', ')}, Format: ${format}, Time: ${timestamp}`);
  // TODO: Store in Appwrite `exports` collection for audit trail
  // Example: await awDatabases.createDocument(APPWRITE_DATABASE_ID, 'exports', 'unique()', {
  //   adminId, sessionIds: JSON.stringify(sessionIds), format, timestamp
  // });
}

// Helper: Stream messages from Appwrite with pagination
async function* streamMessages(sessionId) {
  const limit = 100; // Appwrite pagination limit
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    let result;
    try {
      if (Query) {
        result = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_MESSAGES_COLLECTION_ID,
          [Query.equal('sessionId', sessionId), Query.orderAsc('createdAt')],
          limit,
          offset
        );
      } else {
        // Fallback: fetch all and filter
        const allResult = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_MESSAGES_COLLECTION_ID,
          undefined,
          10000
        );
        const filtered = allResult.documents
          .filter(doc => doc.sessionId === sessionId)
          .sort((a, b) => {
            const timeA = new Date(a.createdAt || a.$createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || b.$createdAt || 0).getTime();
            return timeA - timeB;
          });
        result = { documents: filtered.slice(offset, offset + limit), total: filtered.length };
        hasMore = offset + limit < result.total;
      }
    } catch (err) {
      console.error(`Error fetching messages (offset ${offset}):`, err);
      break;
    }
    
    for (const msg of result.documents) {
      yield msg;
    }
    
    offset += result.documents.length;
    hasMore = result.documents.length === limit && offset < result.total;
  }
}

// Helper: Escape CSV field
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /admin/sessions/:sessionId/export - Export single session conversation
app.get('/admin/sessions/:sessionId/export', requireAdminAuth, async (req, res) => {
  const { sessionId } = req.params;
  const format = (req.query.format || 'json').toLowerCase();
  const authHeader = req.headers.authorization;
  const adminToken = authHeader ? authHeader.substring(7) : 'unknown';
  
  // Rate limiting
  if (!checkRateLimit(adminToken)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Maximum 5 exports per minute.' });
  }
  
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
    return res.status(500).json({ error: 'Appwrite not configured' });
  }
  
  if (format !== 'json' && format !== 'csv') {
    return res.status(400).json({ error: 'Invalid format. Use "json" or "csv"' });
  }
  
  try {
    // Verify session exists
    try {
      await awDatabases.getDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        sessionId
      );
    } catch (err) {
      if (err.code === 404) {
        return res.status(404).json({ error: `Session ${sessionId} not found` });
      }
      throw err;
    }
    
    // Count total messages for size check
    let totalMessages = 0;
    try {
      if (Query) {
        const countResult = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_MESSAGES_COLLECTION_ID,
          [Query.equal('sessionId', sessionId)],
          1
        );
        totalMessages = countResult.total;
      } else {
        // Fallback: estimate from full fetch
        const allResult = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_MESSAGES_COLLECTION_ID,
          undefined,
          10000
        );
        totalMessages = allResult.documents.filter(doc => doc.sessionId === sessionId).length;
      }
    } catch (err) {
      console.warn('Could not count messages:', err);
    }
    
    // Check size limit (100k messages per session)
    if (totalMessages > 100000) {
      return res.status(413).json({ 
        error: `Export too large (${totalMessages} messages). Please use bulk export with background job for large datasets.` 
      });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `aichat_session-${sessionId}_${timestamp}.${format}`;
    
    // Set headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      
      // Stream JSON array
      res.write('[');
      let first = true;
      
      for await (const msg of streamMessages(sessionId)) {
        if (!first) res.write(',');
        first = false;
        
        const jsonMsg = {
          createdAt: msg.createdAt || msg.$createdAt || new Date().toISOString(),
          sender: msg.sender || 'unknown',
          text: msg.text || '',
          confidence: msg.confidence || null,
          metadata: msg.metadata || null
        };
        res.write(JSON.stringify(jsonMsg));
      }
      
      res.write(']');
      res.end();
      
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      
      // CSV header
      res.write('createdAt,sender,text,confidence,metadata\n');
      
      // Stream CSV rows directly
      for await (const msg of streamMessages(sessionId)) {
        const createdAt = escapeCsvField(msg.createdAt || msg.$createdAt || new Date().toISOString());
        const sender = escapeCsvField(msg.sender || 'unknown');
        const text = escapeCsvField(msg.text || '');
        const confidence = escapeCsvField(msg.confidence || '');
        const metadataStr = msg.metadata ? 
          escapeCsvField(typeof msg.metadata === 'string' ? msg.metadata : JSON.stringify(msg.metadata)) : 
          '';
        
        res.write(`${createdAt},${sender},${text},${confidence},${metadataStr}\n`);
      }
      
      res.end();
    }
    
    // Audit log
    logExportAction(adminToken, [sessionId], format);
    console.log(`✅ Exported session ${sessionId} as ${format} (${totalMessages} messages)`);
    
  } catch (err) {
    console.error(`Error exporting session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Failed to export session' });
    }
  }
});

// POST /admin/sessions/export - Bulk export multiple sessions
app.post('/admin/sessions/export', requireAdminAuth, async (req, res) => {
  const { sessionIds, format } = req.body;
  const authHeader = req.headers.authorization;
  const adminToken = authHeader ? authHeader.substring(7) : 'unknown';
  
  // Rate limiting
  if (!checkRateLimit(adminToken)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Maximum 5 exports per minute.' });
  }
  
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
    return res.status(500).json({ error: 'Appwrite not configured' });
  }
  
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return res.status(400).json({ error: 'sessionIds array required' });
  }
  
  if (sessionIds.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 sessions per bulk export' });
  }
  
  const exportFormat = (format || 'json').toLowerCase();
  if (exportFormat !== 'json' && exportFormat !== 'csv') {
    return res.status(400).json({ error: 'Invalid format. Use "json" or "csv"' });
  }
  
  try {
    // Count total messages across all sessions
    let totalMessages = 0;
    const sessionMessageCounts = {};
    
    for (const sessionId of sessionIds) {
      try {
        if (Query) {
          const countResult = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_MESSAGES_COLLECTION_ID,
            [Query.equal('sessionId', sessionId)],
            1
          );
          sessionMessageCounts[sessionId] = countResult.total;
          totalMessages += countResult.total;
        } else {
          // Fallback
          const allResult = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_MESSAGES_COLLECTION_ID,
            undefined,
            10000
          );
          const count = allResult.documents.filter(doc => doc.sessionId === sessionId).length;
          sessionMessageCounts[sessionId] = count;
          totalMessages += count;
        }
      } catch (err) {
        console.warn(`Could not count messages for session ${sessionId}:`, err);
        sessionMessageCounts[sessionId] = 0;
      }
    }
    
    // Check size limit (100k messages total)
    if (totalMessages > 100000) {
      return res.status(413).json({ 
        error: `Export too large (${totalMessages} total messages across ${sessionIds.length} sessions). Please use background job for large bulk exports.` 
      });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bulk_export_${timestamp}.json"`);
      
      // Stream NDJSON (newline-delimited JSON) for large exports
      const sessions = {};
      
      for (const sessionId of sessionIds) {
        const messages = [];
        for await (const msg of streamMessages(sessionId)) {
          messages.push({
            createdAt: msg.createdAt || msg.$createdAt || new Date().toISOString(),
            sender: msg.sender || 'unknown',
            text: msg.text || '',
            confidence: msg.confidence || null,
            metadata: msg.metadata || null
          });
        }
        sessions[sessionId] = messages;
      }
      
      res.json({ sessions });
      
    } else if (exportFormat === 'csv') {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="bulk_export_${timestamp}.zip"`);
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create archive' });
        }
      });
      
      archive.pipe(res);
      
      // Add CSV file for each session
      for (const sessionId of sessionIds) {
        const csvFilename = `session-${sessionId}.csv`;
        let csvData = 'createdAt,sender,text,confidence,metadata\n';
        
        // Stream messages to CSV string
        for await (const msg of streamMessages(sessionId)) {
          const createdAt = escapeCsvField(msg.createdAt || msg.$createdAt || new Date().toISOString());
          const sender = escapeCsvField(msg.sender || 'unknown');
          const text = escapeCsvField(msg.text || '');
          const confidence = escapeCsvField(msg.confidence || '');
          const metadataStr = msg.metadata ? 
            escapeCsvField(typeof msg.metadata === 'string' ? msg.metadata : JSON.stringify(msg.metadata)) : 
            '';
          
          csvData += `${createdAt},${sender},${text},${confidence},${metadataStr}\n`;
        }
        
        archive.append(csvData, { name: csvFilename });
      }
      
      archive.finalize();
    }
    
    // Audit log
    logExportAction(adminToken, sessionIds, exportFormat);
    console.log(`✅ Bulk exported ${sessionIds.length} sessions as ${exportFormat} (${totalMessages} total messages)`);
    
  } catch (err) {
    console.error('Error in bulk export:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Failed to export sessions' });
    }
  }
});

// Theme endpoints

// POST /session/:sessionId/theme - Update session theme
app.post('/session/:sessionId/theme', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { themeVars } = req.body;
    
    if (!themeVars) {
      return res.status(400).json({ error: 'themeVars required' });
    }
    
    if (awDatabases && APPWRITE_DATABASE_ID && APPWRITE_SESSIONS_COLLECTION_ID) {
      await awDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        sessionId,
        { theme: typeof themeVars === 'object' ? JSON.stringify(themeVars) : themeVars }
      );
    }
    
    res.json({ success: true, sessionId, theme: themeVars });
  } catch (err) {
    console.error('Error updating theme:', err);
    res.status(500).json({ error: err?.message || 'Failed to update theme' });
  }
});

// GET /session/:sessionId/theme - Get session theme
app.get('/session/:sessionId/theme', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
      return res.json({ theme: {} });
    }
    
    const doc = await awDatabases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_SESSIONS_COLLECTION_ID,
      sessionId
    );
    
    res.json({ theme: doc.theme || {} });
  } catch (err) {
    if (err.code === 404) {
      return res.json({ theme: {} });
    }
    console.error('Error getting theme:', err);
    res.status(500).json({ error: err?.message || 'Failed to get theme' });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Socket.IO API server listening on port ${PORT}`);
  console.log(`📋 Environment: Gemini=${geminiClient ? '✅' : '❌'}, Appwrite=${awDatabases ? '✅' : '❌'}`);
});

