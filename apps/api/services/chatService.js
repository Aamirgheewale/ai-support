/**
 * Chat Service - Message and Session Database Helper Functions
 * 
 * This service handles all database operations related to chat sessions and messages.
 * It uses dependency injection to accept the Appwrite client and configuration.
 */

/**
 * Creates a chat service instance with the provided dependencies
 * @param {Object} dependencies - Service dependencies
 * @param {Object} dependencies.databases - Appwrite Databases client
 * @param {string} dependencies.databaseId - Appwrite database ID
 * @param {string} dependencies.sessionsCollectionId - Sessions collection ID
 * @param {string} dependencies.messagesCollectionId - Messages collection ID
 * @param {Map} dependencies.sessionAssignments - In-memory session assignment cache (optional)
 * @returns {Object} Chat service with helper functions
 */
function createChatService(dependencies) {
  const {
    databases,
    databaseId,
    sessionsCollectionId,
    messagesCollectionId,
    sessionAssignments = null, // Optional, only needed for assignAgentToSession
    agentSockets = null // Optional, for real-time notifications
  } = dependencies;

  // IO instance (set later via setIo)
  let io = dependencies.io || null;

  function setIo(socketIo) {
    io = socketIo;
  }

  /**
   * Get session document from Appwrite
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} Session document or null if not found
   */
  async function getSessionDoc(sessionId) {
    if (!databases || !databaseId || !sessionsCollectionId) {
      return null;
    }

    try {
      const doc = await databases.getDocument(
        databaseId,
        sessionsCollectionId,
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

  /**
   * Create a proactive session initiated by an agent
   * @param {string} agentId - Agent ID who initiated the session
   * @returns {Promise<string>} The created sessionId
   */
  async function createProactiveSession(agentId) {
    if (!databases || !databaseId || !sessionsCollectionId) {
      console.error(`❌ Cannot create proactive session: Appwrite not configured`);
      throw new Error('Appwrite not configured');
    }

    const newSessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log(`🔍 createProactiveSession called: sessionId=${newSessionId}, agentId=${agentId}`);

    try {
      const now = new Date().toISOString();
      const userMetaObj = {
        source: 'proactive_agent',
        assignedAgent: agentId // Store assignedAgent in userMeta (not as direct attribute)
      };
      const userMetaStr = JSON.stringify(userMetaObj);

      const sessionDoc = {
        sessionId: newSessionId,
        status: 'active',
        lastSeen: now,
        startTime: now,
        theme: '{}',
        userMeta: userMetaStr
      };

      // Remove any null/undefined values
      Object.keys(sessionDoc).forEach(key => {
        if (sessionDoc[key] === null || sessionDoc[key] === undefined) {
          delete sessionDoc[key];
        }
      });

      console.log(`📤 Creating proactive session document: ${newSessionId}`);
      console.log(`   Database: ${databaseId}, Collection: ${sessionsCollectionId}`);
      console.log(`   Session doc keys: ${Object.keys(sessionDoc).join(', ')}`);
      console.log(`   Session doc:`, JSON.stringify(sessionDoc, null, 2));

      const result = await databases.createDocument(
        databaseId,
        sessionsCollectionId,
        newSessionId,
        sessionDoc
      );

      console.log(`✅ Created proactive session in Appwrite: ${newSessionId}`);
      console.log(`   Result document ID: ${result.$id}`);
      return newSessionId;
    } catch (err) {
      console.error(`❌ Failed to create proactive session [${newSessionId}]:`, err?.message || err);
      console.error(`   Error code: ${err?.code}, Error type: ${err?.type}`);
      console.error(`   Full error:`, err);
      throw err;
    }
  }

  /**
   * Create a new session in Appwrite (always creates, never updates)
   * @param {Object} options - Session creation options
   * @param {string} options.assignedAgentId - Agent ID who initiated the session (optional)
   * @param {string} options.status - Session status (default: 'agent_initiated')
   * @param {Object} options.userMeta - Additional user metadata (optional)
   * @returns {Promise<string>} The created sessionId
   */
  async function createSession(options = {}) {
    if (!databases || !databaseId || !sessionsCollectionId) {
      console.error(`❌ Cannot create session: Appwrite not configured`);
      throw new Error('Appwrite not configured');
    }

    const { assignedAgentId, status = 'agent_initiated', userMeta = {} } = options;
    const newSessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log(`🔍 createSession called: sessionId=${newSessionId}, status=${status}`);

    try {
      const now = new Date().toISOString();
      const userMetaObj = {
        ...userMeta,
        ...(assignedAgentId && { assignedAgent: assignedAgentId })
      };
      const userMetaStr = JSON.stringify(userMetaObj);

      const sessionDoc = {
        sessionId: newSessionId,
        status: status,
        lastSeen: now,
        startTime: now,
        theme: '{}',
        userMeta: userMetaStr
      };

      // Remove any null/undefined values
      Object.keys(sessionDoc).forEach(key => {
        if (sessionDoc[key] === null || sessionDoc[key] === undefined) {
          delete sessionDoc[key];
        }
      });

      console.log(`📤 Creating new session document: ${newSessionId}`);

      await databases.createDocument(
        databaseId,
        sessionsCollectionId,
        newSessionId,
        sessionDoc
      );

      console.log(`✅ Created new session in Appwrite: ${newSessionId}`);
      return newSessionId;
    } catch (err) {
      console.error(`❌ Failed to create session [${newSessionId}]:`, err?.message || err);
      throw err;
    }
  }

  /**
   * Update session status in Appwrite
   * @param {string} sessionId - Session identifier
   * @param {string} status - New status (e.g. 'closed', 'active')
   * @param {Object} additionalUpdates - Additional fields to update (optional)
   * @returns {Promise<boolean>} True if successful
   */
  async function updateSessionStatus(sessionId, status, additionalUpdates = {}) {
    if (!databases || !databaseId || !sessionsCollectionId) {
      return false;
    }

    try {
      const updateData = {
        status,
        ...additionalUpdates
      };

      await databases.updateDocument(
        databaseId,
        sessionsCollectionId,
        sessionId,
        updateData
      );
      console.log(`✅ Updated session status to '${status}' with fields: ${Object.keys(additionalUpdates).join(', ')}`);
      return true;
    } catch (err) {
      console.error(`❌ Failed to update session status [${sessionId}]:`, err?.message);
      return false;
    }
  }

  /**
   * Ensure session exists in Appwrite (create if not exists, update lastSeen if exists)
   * @param {string} sessionId - Session identifier
   * @param {Object} userMeta - User metadata object
   * @returns {Promise<boolean>} True if session was created/updated successfully
   */
  async function ensureSessionInAppwrite(sessionId, userMeta = {}) {
    if (!databases || !databaseId || !sessionsCollectionId) {
      console.error(`❌ Cannot create session: Appwrite not configured`);
      console.error(`   databases: ${!!databases}, DB_ID: ${!!databaseId}, SESSIONS_COLL_ID: ${!!sessionsCollectionId}`);
      return false;
    }

    console.log(`🔍 ensureSessionInAppwrite called: sessionId=${sessionId}`);

    try {
      const now = new Date().toISOString();
      const userMetaStr = typeof userMeta === 'object' ? JSON.stringify(userMeta) : (userMeta || '{}');

      const sessionDoc = {
        sessionId: sessionId,
        status: 'active',
        lastSeen: now,
        startTime: now,
        theme: '{}',
        userMeta: userMetaStr
      };

      // Remove any null/undefined values
      Object.keys(sessionDoc).forEach(key => {
        if (sessionDoc[key] === null || sessionDoc[key] === undefined) {
          delete sessionDoc[key];
        }
      });

      console.log(`📤 Creating session document: ${sessionId}`);
      console.log(`📤 Document keys: ${Object.keys(sessionDoc).join(', ')}`);

      await databases.createDocument(
        databaseId,
        sessionsCollectionId,
        sessionId,
        sessionDoc
      );
      console.log(`✅ Created session in Appwrite: ${sessionId}`);
      return true;
    } catch (err) {
      if (err.code === 409) {
        // Session exists, update lastSeen only (don't overwrite userMeta to preserve assignedAgent)
        console.log(`ℹ️  Session already exists [${sessionId}], updating lastSeen...`);
        try {
          await databases.updateDocument(
            databaseId,
            sessionsCollectionId,
            sessionId,
            {
              lastSeen: new Date().toISOString()
              // Don't update userMeta here - it might contain assignedAgent info
            }
          );
          console.log(`✅ Updated session lastSeen in Appwrite: ${sessionId}`);
          return true;
        } catch (updateErr) {
          console.error(`❌ Failed to update session ${sessionId}:`, updateErr?.message || updateErr);
          console.error(`   Error code: ${updateErr?.code}, Type: ${updateErr?.type}`);
          return false;
        }
      } else {
        // Log detailed error information
        console.error(`❌ Failed to create session [${sessionId}]:`, err?.message || err);
        console.error(`   Error code: ${err?.code}, Type: ${err?.type}`);

        // Provide helpful error messages
        if (err?.code === 400) {
          console.error(`   💡 Bad request - Check collection attributes:`);
          console.error(`      Required: sessionId (string), status (string), lastSeen (datetime), startTime (datetime), userMeta (string), theme (string)`);
          if (err?.message?.includes('Unknown attribute')) {
            console.error(`   🔧 Fix: Remove unknown attributes or add them to collection schema in Appwrite Console`);
            // Try creating with minimal fields only
            console.log(`   🔄 Retrying with minimal fields only...`);
            try {
              const minimalDoc = {
                sessionId: sessionId,
                status: 'active',
                lastSeen: new Date().toISOString(),
                startTime: new Date().toISOString(),
                userMeta: '{}',
                theme: '{}'
              };
              await databases.createDocument(
                databaseId,
                sessionsCollectionId,
                sessionId,
                minimalDoc
              );
              console.log(`✅ Created session with minimal fields: ${sessionId}`);
              return true;
            } catch (retryErr) {
              console.error(`   ❌ Retry also failed:`, retryErr?.message || retryErr);
            }
          }
        } else if (err?.code === 401) {
          console.error(`   💡 Authentication failed - Check API key scopes`);
        } else if (err?.code === 403) {
          console.error(`   💡 Permission denied - Check API key has write access`);
        } else if (err?.code === 404) {
          console.error(`   💡 Collection or Database not found - Check IDs are correct`);
          console.error(`      databaseId: ${databaseId ? '✅ Set' : '❌ Missing'}`);
          console.error(`      sessionsCollectionId: ${sessionsCollectionId ? '✅ Set' : '❌ Missing'}`);
        }

        return false;
      }
    }
  }

  /**
   * Save message to Appwrite
   * @param {string} sessionId - Session identifier
   * @param {string} sender - Message sender ('user', 'bot', 'agent', 'system', or 'internal')
   * @param {string} text - Message text
   * @param {Object} metadata - Message metadata (optional)
   * @param {string} visibility - Message visibility ('public' or 'internal', default: 'public')
   * @returns {Promise<boolean>} True if message was saved successfully
   */
  async function saveMessageToAppwrite(sessionId, sender, text, metadata = {}, visibility = 'public') {
    console.log(`🔍 saveMessageToAppwrite called: sessionId=${sessionId}, sender=${sender}, textLength=${text?.length || 0}`);
    console.log(`🔍 Appwrite check: databases=${!!databases}, DB_ID=${!!databaseId}, MSG_COLL_ID=${!!messagesCollectionId}`);

    if (!databases || !databaseId || !messagesCollectionId) {
      if (!databaseId) {
        console.error(`❌ Cannot save message: databaseId is not set in .env`);
      } else if (!messagesCollectionId) {
        console.error(`❌ Cannot save message: messagesCollectionId is not set in .env`);
      } else if (!databases) {
        console.error(`❌ Cannot save message: Appwrite client not initialized`);
      }
      return false;
    }

    try {
      // Ensure session exists before saving message - CRITICAL for admin panel visibility
      console.log(`🔍 Ensuring session exists before saving message: ${sessionId}`);
      let sessionEnsured = await ensureSessionInAppwrite(sessionId);
      if (!sessionEnsured) {
        console.error(`❌ CRITICAL: Failed to ensure session [${sessionId}] - retrying with minimal fields...`);
        // Retry with absolute minimal fields - this MUST succeed for admin panel to work
        try {
          const minimalSession = {
            sessionId: sessionId,
            status: 'active',
            lastSeen: new Date().toISOString(),
            startTime: new Date().toISOString(),
            userMeta: '{}',
            theme: '{}'
          };
          await databases.createDocument(
            databaseId,
            sessionsCollectionId,
            sessionId,
            minimalSession
          );
          console.log(`✅ Created session with minimal fields (retry): ${sessionId}`);
          sessionEnsured = true;
        } catch (retryErr) {
          if (retryErr.code === 409) {
            // Session exists now (race condition), that's fine
            console.log(`ℹ️  Session exists (race condition): ${sessionId}`);
            sessionEnsured = true;
          } else {
            console.error(`❌ CRITICAL: Retry also failed - session [${sessionId}] will NOT appear in admin panel!`);
            console.error(`   Error: ${retryErr?.message || retryErr}`);
            // Continue anyway - save the message even if session creation failed
          }
        }
      }

      const now = new Date().toISOString();
      let metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || '{}');
      // Ensure metadata is a string and truncate to 255 chars (Appwrite requirement)
      if (typeof metadataStr !== 'string') {
        metadataStr = String(metadataStr);
      }
      if (metadataStr.length > 255) {
        metadataStr = metadataStr.substring(0, 252) + '...'; // 252 + 3 = 255 chars
      }

      const messageDoc = {
        sessionId: sessionId,
        sender: sender,
        createdAt: now,
        confidence: metadata.confidence || null
      };

      // Always set text and metadata (required fields)
      // Ensure text is a non-empty string (Appwrite requirement)
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.error(`❌ Invalid text for message: text must be a non-empty string`);
        return false;
      }

      messageDoc.text = text;
      messageDoc.metadata = metadataStr; // Ensure metadata is always a string <= 255 chars

      // Add type and attachmentUrl if present (for image attachments)
      if (metadata.type) {
        messageDoc.type = metadata.type;
      }
      if (metadata.attachmentUrl) {
        messageDoc.attachmentUrl = metadata.attachmentUrl;
      }

      // Add visibility flag for internal notes (only visible to agents)
      if (visibility === 'internal') {
        messageDoc.visibility = 'internal';
        // Also store in metadata for backward compatibility
        try {
          const metaObj = typeof metadata === 'object' ? metadata : JSON.parse(metadataStr || '{}');
          metaObj.visibility = 'internal';
          messageDoc.metadata = JSON.stringify(metaObj).substring(0, 252) + (JSON.stringify(metaObj).length > 252 ? '...' : '');
        } catch (e) {
          // If metadata parsing fails, just add visibility to document
        }
      }

      // NOTE: Encrypted fields are NOT added by default to avoid schema errors
      // Only add encrypted fields if:
      // 1. Encryption is enabled AND
      // 2. The collection schema has been updated to include 'encrypted' and 'encrypted_metadata' attributes
      // To enable encryption, first run the migration script to add these attributes to your collection
      // For now, we save only plaintext to ensure compatibility with existing schema

      // Remove any null/undefined values that might cause Appwrite validation errors
      Object.keys(messageDoc).forEach(key => {
        if (messageDoc[key] === null || messageDoc[key] === undefined) {
          delete messageDoc[key];
        }
      });

      console.log(`📤 Creating document in Appwrite: DB=${databaseId}, COLL=${messagesCollectionId}`);
      console.log(`📤 Document data keys: ${Object.keys(messageDoc).join(', ')}`);
      console.log(`📤 Text field present: ${!!messageDoc.text}, Text length: ${messageDoc.text?.length || 0}`);

      const result = await databases.createDocument(
        databaseId,
        messagesCollectionId,
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
      console.error(`   Message text (first 50 chars): ${text ? text.substring(0, 50) : '(empty)'}`);
      console.error(`   Sender: ${sender}`);

      // Provide helpful error messages
      if (err?.code === 404) {
        console.error(`   💡 Collection or Database not found. Check:`);
        console.error(`      - databaseId: ${databaseId ? '✅ Set' : '❌ Missing'}`);
        console.error(`      - messagesCollectionId: ${messagesCollectionId ? '✅ Set' : '❌ Missing'}`);
        console.error(`      - Verify IDs in Appwrite Console → Databases`);
      } else if (err?.code === 401) {
        console.error(`   💡 Authentication failed - API Key Missing Scopes`);
        console.error(`   🔧 Fix: Go to Appwrite Console → Settings → API Keys`);
        console.error(`      Edit your API key and enable these scopes:`);
        console.error(`      - databases.read, databases.write`);
        console.error(`      - collections.read, collections.write`);
        console.error(`      - documents.read, documents.write`);
      } else if (err?.code === 403) {
        console.error(`   💡 Permission denied. Check API key has write access to database`);
        console.error(`   🔧 Fix: Update API key scopes in Appwrite Console`);
      } else if (err?.code === 400) {
        console.error(`   💡 Bad request. Check collection attributes match:`);
        console.error(`      Required: sessionId (string), sender (string), text (string), createdAt (datetime), metadata (string), confidence (double)`);
        console.error(`   Full error message: ${err?.message || 'No message'}`);
        console.error(`   Error response: ${JSON.stringify(err?.response || {})}`);
        if (err?.message?.includes('createdAt')) {
          console.error(`   🔧 Fix: Add createdAt attribute to messages collection in Appwrite Console`);
        }
        if (err?.message?.includes('text')) {
          console.error(`   🔧 Fix: Check 'text' attribute exists and is of type 'string' in messages collection`);
        }
        if (err?.message?.includes('metadata') && err?.message?.includes('255')) {
          console.error(`   🔧 Fix: Metadata field exceeded 255 characters - this should be automatically truncated`);
          console.error(`   🔧 Metadata length was: ${metadataStr?.length || 0} chars`);
        }
        if (err?.message?.includes('Unknown attribute') || err?.message?.includes('Invalid document structure')) {
          console.error(`   🔧 Fix: Remove 'encrypted' or 'encrypted_metadata' fields from messageDoc if they don't exist in collection schema`);
          console.error(`   🔧 Or add these attributes to the messages collection in Appwrite Console`);
        }
      } else {
        console.error(`   💡 Unexpected error code: ${err?.code}`);
        console.error(`   Full error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
      }

      return false;
    }
  }

  /**
   * Mark session as needing human help
   * @param {string} sessionId - Session identifier
   * @param {string} reason - Reason for marking (optional)
   * @returns {Promise<void>}
   */
  async function markSessionNeedsHuman(sessionId, reason) {
    if (!databases || !databaseId || !sessionsCollectionId) {
      return;
    }

    try {
      await databases.updateDocument(
        databaseId,
        sessionsCollectionId,
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

  /**
   * Set session resolution (close status and attribution)
   * @param {string} sessionId - Session identifier
   * @param {string} resolutionText - Text for assignedAgent field (e.g. "Solved by AI (Gemini)")
   * @returns {Promise<boolean>} True if successful
   */
  async function setSessionResolution(sessionId, resolutionText) {
    if (!databases || !databaseId || !sessionsCollectionId) return false;

    try {
      // Get current session to preserve userMeta
      const session = await getSessionDoc(sessionId);
      if (!session) return false;

      // Parse userMeta
      let userMeta = {};
      try {
        userMeta = typeof session.userMeta === 'string'
          ? JSON.parse(session.userMeta || '{}')
          : (session.userMeta || {});
      } catch (e) {
        userMeta = {};
      }

      // Update in userMeta
      userMeta.assignedAgent = resolutionText;

      // Prepare update payload
      const updateDoc = {
        status: 'closed',
        lastSeen: new Date().toISOString(),
        userMeta: JSON.stringify(userMeta)
      };

      // Try adding assignedAgent as top-level field if supported
      updateDoc.assignedAgent = resolutionText;

      try {
        await databases.updateDocument(
          databaseId,
          sessionsCollectionId,
          sessionId,
          updateDoc
        );
        console.log(`✅ Closed session ${sessionId} resolved by: ${resolutionText}`);
        return true;
      } catch (updateErr) {
        // Fallback: Retry without top-level assignedAgent if schema rejects it
        if (updateErr?.code === 400 || updateErr?.message?.includes('Unknown attribute')) {
          console.log(`⚠️  assignedAgent field not in collection, falling back to userMeta only`);
          delete updateDoc.assignedAgent;

          await databases.updateDocument(
            databaseId,
            sessionsCollectionId,
            sessionId,
            updateDoc
          );
          console.log(`✅ Closed session ${sessionId} (resolution stored in userMeta)`);
          return true;
        } else {
          throw updateErr;
        }
      }
    } catch (err) {
      console.error(`❌ Failed to set session resolution [${sessionId}]:`, err?.message);
      return false;
    }
  }

  /**
   * Assign agent to session
   * @param {string} sessionId - Session identifier
   * @param {string} agentId - Agent identifier
   * @param {string} agentName - Agent name (optional, for system messages)
   * @returns {Promise<void>}
   */
  async function assignAgentToSession(sessionId, agentId, agentName = null) {
    if (!databases || !databaseId || !sessionsCollectionId) {
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
        await databases.updateDocument(
          databaseId,
          sessionsCollectionId,
          sessionId,
          updateDoc
        );
        console.log(`✅ Assigned agent ${agentId} to session ${sessionId} (AI paused)`);
        // Cache in memory for fast lookup (if sessionAssignments provided)
        if (sessionAssignments) {
          sessionAssignments.set(sessionId, { agentId, aiPaused: true });
        }
      } catch (updateErr) {
        // If update fails due to unknown fields, remove them and retry
        if (updateErr?.code === 400 || updateErr?.message?.includes('Unknown attribute') || updateErr?.message?.includes('Invalid document structure')) {
          console.log(`⚠️  assignedAgent/aiPaused fields not in collection, using userMeta only`);

          // Retry without assignedAgent/aiPaused fields
          await databases.updateDocument(
            databaseId,
            sessionsCollectionId,
            sessionId,
            {
              status: 'agent_assigned',
              lastSeen: new Date().toISOString(),
              userMeta: JSON.stringify(userMeta)
            }
          );
          console.log(`✅ Assigned agent ${agentId} to session ${sessionId} (stored in userMeta, AI paused)`);
          // Cache in memory for fast lookup (if sessionAssignments provided)
          if (sessionAssignments) {
            sessionAssignments.set(sessionId, { agentId, aiPaused: true });
          }
        } else {
          // Re-throw if it's a different error
          throw updateErr;
        }
      }

      // Create assignment notification in Appwrite
      try {
        const { ID } = require('node-appwrite');
        const APPWRITE_NOTIFICATIONS_COLLECTION_ID = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID || 'notifications';

        const notificationData = {
          type: 'assignment',
          content: `Session ${sessionId} assigned to you`,
          sessionId: sessionId,
          targetUserId: agentId, // Notify specific agent
          isRead: false
        };

        await databases.createDocument(
          databaseId,
          APPWRITE_NOTIFICATIONS_COLLECTION_ID,
          ID.unique(),
          notificationData
        );

        console.log(`✅ Created assignment notification for agent ${agentId} on session ${sessionId}`);

        // Emit real-time notification to specific agent
        if (io && agentSockets) {
          const socketId = agentSockets.get(agentId);
          if (socketId) {
            io.to(socketId).emit('new_notification', notificationData);
            console.log(`📡 Emitted real-time notification to agent ${agentId} (socket: ${socketId})`);
          } else {
            console.log(`⚠️ Agent ${agentId} not connected to socket, notification saved to DB only`);
          }
        }
      } catch (notifErr) {
        console.warn(`⚠️  Failed to create assignment notification:`, notifErr?.message || notifErr);
        // Don't throw - notification failure shouldn't break assignment
      }
    } catch (err) {
      console.error(`❌ Failed to assign agent to session:`, err?.message || err);
      console.error(`   Error code: ${err?.code}, Type: ${err?.type}`);
      throw err;
    }
  }

  // Return service object with all functions
  return {
    getSessionDoc,
    createSession,
    createProactiveSession,
    ensureSessionInAppwrite,
    saveMessageToAppwrite,
    markSessionNeedsHuman,
    saveMessageToAppwrite,
    markSessionNeedsHuman,
    assignAgentToSession,
    updateSessionStatus,
    setSessionResolution,
    setIo
  };
}

module.exports = {
  createChatService
};
