require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const archiver = require('archiver');
const { stringify } = require('csv-stringify');
const { LRUCache } = require('lru-cache');

// Encryption library
let encryption = null;
try {
  encryption = require('./lib/encryption');
  console.log('✅ Encryption library loaded');
} catch (e) {
  console.warn('⚠️  Encryption library not available:', e?.message || e);
}

// Pagination helper
const { parsePaginationParams, validatePaginationParams, calculatePaginationMeta } = require('./lib/parsePaginationParams');

// Security headers (helmet)
let helmet = null;
try {
  helmet = require('helmet');
  console.log('✅ Helmet security middleware loaded');
} catch (e) {
  console.warn('⚠️  Helmet not available (run: pnpm add helmet):', e?.message || e);
}

const app = express();

// Security headers (helmet)
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for Socket.IO compatibility
    crossOriginEmbedderPolicy: false
  }));
  console.log('✅ Security headers enabled (helmet)');
}

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
const APPWRITE_USERS_COLLECTION_ID = 'users'; // Collection name (not ID)
const APPWRITE_ROLE_CHANGES_COLLECTION_ID = 'roleChanges'; // Collection name
const APPWRITE_AI_ACCURACY_COLLECTION_ID = 'ai_accuracy'; // Collection name
const APPWRITE_ACCURACY_AUDIT_COLLECTION_ID = 'accuracy_audit'; // Collection name

// Accuracy logging configuration
const ACCURACY_RETENTION_DAYS = parseInt(process.env.ACCURACY_RETENTION_DAYS || '365', 10);
const ACCURACY_MAX_SCAN_ROWS = parseInt(process.env.ACCURACY_MAX_SCAN_ROWS || '200000', 10);
const REDACT_PII = process.env.REDACT_PII === 'true';

// Encryption configuration
const MASTER_KEY_BASE64 = process.env.MASTER_KEY_BASE64;
const ENCRYPTION_ENABLED = !!MASTER_KEY_BASE64 && !!encryption;

if (ENCRYPTION_ENABLED) {
  try {
    const keyBuffer = Buffer.from(MASTER_KEY_BASE64, 'base64');
    if (keyBuffer.length !== 32) {
      console.warn('⚠️  MASTER_KEY_BASE64 must be 32 bytes (256 bits) when decoded');
    } else {
      console.log('✅ Encryption enabled (MASTER_KEY_BASE64 present)');
      console.log('   ⚠️  PRODUCTION: Use KMS (AWS KMS/GCP KMS/HashiCorp Vault) instead of plaintext key');
    }
  } catch (e) {
    console.warn('⚠️  Invalid MASTER_KEY_BASE64 format:', e?.message || e);
  }
} else {
  console.warn('⚠️  Encryption disabled (MASTER_KEY_BASE64 not set or encryption library missing)');
  console.warn('   Sensitive data will be stored in plaintext');
}

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
    console.log(`   Ai Accuracy: ${APPWRITE_AI_ACCURACY_COLLECTION_ID ? '✅ Set' : '❌ Missing'}`);
    
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

// ============================================================================
// RBAC (Role-Based Access Control) Implementation
// ============================================================================

const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';

// RBAC Helper Functions
async function getUserById(userId) {
  if (!awDatabases || !APPWRITE_DATABASE_ID) {
    console.warn('⚠️  Appwrite not configured, cannot fetch user');
    return null;
  }
  try {
    if (!Query) {
      console.warn('⚠️  Query class not available');
      return null;
    }
    const result = await awDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_USERS_COLLECTION_ID,
      [Query.equal('userId', userId)],
      1
    );
    return result.documents.length > 0 ? result.documents[0] : null;
  } catch (err) {
    // If collection doesn't exist or attribute not found, return null (migration not run yet)
    if (err.code === 404 || err.type === 'general_query_invalid' || err.message?.includes('not found')) {
      return null;
    }
    console.error('Error fetching user by ID:', err.message || err);
    return null;
  }
}

async function getUserByEmail(email) {
  if (!awDatabases || !APPWRITE_DATABASE_ID) {
    return null;
  }
  try {
    if (!Query) {
      return null;
    }
    const result = await awDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_USERS_COLLECTION_ID,
      [Query.equal('email', email)],
      1
    );
    return result.documents.length > 0 ? result.documents[0] : null;
  } catch (err) {
    // If collection doesn't exist or attribute not found, return null
    if (err.code === 404 || err.type === 'general_query_invalid' || err.message?.includes('not found')) {
      return null;
    }
    console.error('Error fetching user by email:', err.message || err);
    return null;
  }
}

async function ensureUserRecord(requestedUserId, { email, name }) {
  if (!awDatabases || !APPWRITE_DATABASE_ID) {
    console.warn('⚠️  Appwrite not configured, cannot ensure user record');
    return null;
  }
  const generateUserId = () => `${(email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  let targetUserId = requestedUserId || generateUserId();
  try {

    // Check for existing user by userId first
    let existing = await getUserById(targetUserId);
    
    // Also check by email (in case userId is NULL in database)
    if (!existing) {
      existing = await getUserByEmail(email);
      // If found by email but userId is NULL or different, update it
      if (existing && (!existing.userId || existing.userId !== targetUserId)) {
        console.log(`⚠️  Found user by email "${email}" but userId is ${existing.userId || 'NULL'}. Updating userId to "${targetUserId}"...`);
        try {
          const updateData = {
            userId: targetUserId, // Set or update userId
            email,
            name: name || existing.name || email
          };
          try {
            await awDatabases.updateDocument(
              APPWRITE_DATABASE_ID,
              APPWRITE_USERS_COLLECTION_ID,
              existing.$id,
              {
                ...updateData,
                updatedAt: new Date().toISOString()
              }
            );
          } catch (e) {
            await awDatabases.updateDocument(
              APPWRITE_DATABASE_ID,
              APPWRITE_USERS_COLLECTION_ID,
              existing.$id,
              updateData
            );
          }
          return { ...existing, ...updateData };
        } catch (updateErr) {
          console.error(`❌ Failed to update userId for existing user:`, updateErr.message);
          // Continue to return existing user even if update fails
          return existing;
        }
      }
    }
    
    if (existing) {
      // Update existing user
      const { ID } = require('node-appwrite');
      const updateData = {
        email,
        name: name || existing.name
      };
      // Ensure userId is set if it was NULL
      if (!existing.userId || existing.userId !== targetUserId) {
        updateData.userId = targetUserId;
      }
      // Only add updatedAt if the attribute exists
      try {
        await awDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          existing.$id,
          {
            ...updateData,
            updatedAt: new Date().toISOString()
          }
        );
      } catch (e) {
        // If updatedAt doesn't exist, try without it
        await awDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          existing.$id,
          updateData
        );
      }
      return { ...existing, ...updateData };
    } else {
      // Before creating, do a comprehensive check for existing users
      // This prevents unique constraint violations
      let existingUser = null;
      
      // Check by email first
      try {
        existingUser = await getUserByEmail(email);
        if (existingUser) {
          // If userId is NULL or different, update it
          if (!existingUser.userId || existingUser.userId !== targetUserId) {
            console.log(`⚠️  Found user by email "${email}" but userId is ${existingUser.userId || 'NULL'}. Updating userId to "${targetUserId}"...`);
            try {
              const updateData = {
                userId: targetUserId,
                email,
                name: name || existingUser.name || email
              };
              try {
                await awDatabases.updateDocument(
                  APPWRITE_DATABASE_ID,
                  APPWRITE_USERS_COLLECTION_ID,
                  existingUser.$id,
                  {
                    ...updateData,
                    updatedAt: new Date().toISOString()
                  }
                );
              } catch (e) {
                await awDatabases.updateDocument(
                  APPWRITE_DATABASE_ID,
                  APPWRITE_USERS_COLLECTION_ID,
                  existingUser.$id,
                  updateData
                );
              }
              return { ...existingUser, ...updateData };
            } catch (updateErr) {
              console.error(`❌ Failed to update userId:`, updateErr.message);
              // Return existing user even if update fails
              return existingUser;
            }
          }
          console.log(`✅ Found existing user by email "${email}" before creation, returning existing record`);
          return existingUser;
        }
      } catch (emailErr) {
        console.warn(`⚠️  Error checking by email:`, emailErr.message);
      }
      
      // Check by userId
      try {
        existingUser = await getUserById(targetUserId);
        if (existingUser) {
          console.log(`✅ Found existing user by userId "${targetUserId}" before creation, returning existing record`);
          return existingUser;
        }
      } catch (idErr) {
        console.warn(`⚠️  Error checking by userId:`, idErr.message);
      }
      
      // Final comprehensive check: list all users and search manually
      // This catches edge cases where queries might fail but user exists
      try {
        const allUsers = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          [],
          100
        );
        const matchingUser = allUsers.documents.find(doc => 
          (doc.email && doc.email === email) || (doc.userId && doc.userId === targetUserId)
        );
        if (matchingUser) {
          console.log(`✅ Found existing user via comprehensive list check`);
          // Update userId if needed
          if (!matchingUser.userId && targetUserId) {
            try {
              await awDatabases.updateDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_USERS_COLLECTION_ID,
                matchingUser.$id,
                { userId: targetUserId }
              );
              matchingUser.userId = targetUserId;
            } catch (updateErr) {
              console.warn(`⚠️  Could not update userId:`, updateErr.message);
            }
          }
          return matchingUser;
        }
      } catch (listErr) {
        console.warn(`⚠️  Could not perform comprehensive list check:`, listErr.message);
      }
      
      // Create new user
      // Add a small delay to allow any previous operations to complete and indexes to sync
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { ID } = require('node-appwrite');
      const buildUserDocumentPayload = (includeTimestamps = true) => {
        const base = {
          userId: targetUserId,
          email,
          name: name || email,
          roles: []
        };
        if (!includeTimestamps) {
          return base;
        }
        const now = new Date().toISOString();
        return {
          ...base,
          createdAt: now,
          updatedAt: now
        };
      };
      const deleteDocIfExists = async (docIdToDelete) => {
        if (!docIdToDelete) return;
        try {
          await awDatabases.deleteDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_USERS_COLLECTION_ID,
            docIdToDelete
          );
          console.warn(`   ⚠️  Deleted leftover document with ID ${docIdToDelete} after conflict`);
        } catch (deleteErr) {
          // Ignore if document isn't found
        }
      };
      
      // Try creating document - handle missing attributes gracefully
      let docId;
      try {
        // First try with all fields including datetime
        // Use ID.unique() to generate a unique document ID
        // IMPORTANT: Always use ID.unique() to avoid document ID conflicts
        docId = ID.unique();
        const doc = await awDatabases.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          docId,
          buildUserDocumentPayload()
        );
        console.log(`✅ Successfully created user with document ID: ${docId}`);
        
        // Add delay to allow index sync, then verify user exists
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify the user exists by querying (with fallback to list)
        try {
          const verifyUser = await getUserById(targetUserId) || await getUserByEmail(email);
          if (verifyUser) {
            return verifyUser;
          }
          // Fallback: list all users and find by document ID
          const allUsers = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_USERS_COLLECTION_ID,
            [],
            100
          );
          const foundDoc = allUsers.documents.find(d => d.$id === docId);
          if (foundDoc) {
            console.log(`✅ Verified user exists via list query after creation`);
            return foundDoc;
          }
        } catch (verifyErr) {
          console.warn(`⚠️  Could not verify user after creation, but creation succeeded:`, verifyErr.message);
          // Return the doc anyway since creation succeeded
        }
        
        return doc;
      } catch (e) {
        // Check if it's a unique constraint violation (email or userId already exists) or document ID conflict
        if (e.code === 409 || e.message?.includes('already exists') || e.message?.includes('unique') || e.message?.includes('requested ID already exists')) {
          // Attempt to delete the conflicting document ID in case it was partially created
          await deleteDocIfExists(typeof docId !== 'undefined' ? docId : null);
          console.log(`⚠️  Conflict detected during creation (409), performing comprehensive search...`);
          console.log(`   Error details: ${e.message}`);
          
          // When we get a 409, it could be:
          // 1. Document ID already exists (shouldn't happen with ID.unique() but might due to race condition)
          // 2. Unique constraint on email/userId (user exists)
          // 3. Index sync delay (user was created but not queryable yet)
          
          // First, try to find existing user by email/userId (this handles case 2 and 3)
          let foundUser = null;
          const maxRetries = 3; // Reduced retries - faster response
          const delays = [300, 500, 1000]; // Shorter delays
          
          for (let attempt = 0; attempt < maxRetries && !foundUser; attempt++) {
            if (attempt > 0) {
              console.log(`   Retry ${attempt}/${maxRetries - 1}: Waiting ${delays[attempt - 1]}ms for index sync...`);
              await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
            }
            
            // Try all search methods
            try {
              foundUser = await getUserByEmail(email);
              if (foundUser) {
                console.log(`✅ Found user by email after ${attempt + 1} attempt(s)`);
                break;
              }
            } catch (err) {
              // Ignore
            }
            
            if (!foundUser) {
              try {
                foundUser = await getUserById(targetUserId);
                foundUser = await getUserById(targetUserId);
                if (foundUser) {
                  console.log(`✅ Found user by userId after ${attempt + 1} attempt(s)`);
                  break;
                }
              } catch (err) {
                // Ignore
              }
            }
            
            // Always try listing all documents (no filters = no index dependency)
            if (!foundUser) {
              try {
                // List without any queries - this should work even if indexes aren't synced
                const allUsers = await awDatabases.listDocuments(
                  APPWRITE_DATABASE_ID,
                  APPWRITE_USERS_COLLECTION_ID,
                  [], // No queries = no index dependency
                  1000 // Get more documents
                );
                foundUser = allUsers.documents.find(doc => 
                  (doc.email && doc.email === email) || (doc.userId && doc.userId === targetUserId)
                );
                if (foundUser) {
                  console.log(`✅ Found user via unfiltered list query after ${attempt + 1} attempt(s)`);
                  break;
                }
              } catch (listErr) {
                console.warn(`   ⚠️  List query failed on attempt ${attempt + 1}:`, listErr.message);
              }
            }
          }
          
          if (foundUser) {
            console.log(`✅ User found after conflict resolution, returning existing record`);
            return foundUser;
          }
          
          // If still not found, the user exists (409 conflict confirms it) but indexes haven't synced
          // Wait one final time (longer) and do one more comprehensive search
          // DO NOT try to create again - 409 means user already exists
          console.warn(`⚠️  User not found after ${maxRetries} attempts`);
          console.warn(`   User exists (409 conflict confirmed) but indexes not synced. Waiting 5s for final sync...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Final comprehensive search - list ALL documents without any filters (no index dependency)
          try {
            const finalSearch = await awDatabases.listDocuments(
              APPWRITE_DATABASE_ID,
              APPWRITE_USERS_COLLECTION_ID,
              [], // No queries = no index dependency
              1000 // Get as many as possible
            );
            
            const finalMatch = finalSearch.documents.find(doc => 
              (doc.email && doc.email === email) || (doc.userId && doc.userId === targetUserId)
            );
            
            if (finalMatch) {
              console.log(`✅ Found user after extended wait (5s) - indexes have synced`);
              return finalMatch;
            }
          } catch (finalErr) {
            console.warn(`   ⚠️  Final search also failed:`, finalErr.message);
          }
          
          // If still not found after extended wait, try one more time with even longer wait
          // and paginate through ALL documents to find the user
          console.warn(`⚠️  User confirmed to exist (409 conflict) but not queryable after extended wait`);
          console.warn(`   Trying one final search with pagination through all documents...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 more seconds
          
          // Paginate through ALL documents to find the user
          let allDocs = [];
          let offset = 0;
          const pageSize = 100;
          let hasMore = true;
          
          while (hasMore && allDocs.length < 10000) { // Safety limit
            try {
              const page = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_USERS_COLLECTION_ID,
                [],
                pageSize,
                offset
              );
              allDocs = allDocs.concat(page.documents);
              hasMore = page.documents.length === pageSize;
              offset += pageSize;
              
              // Check if we found the user in this page
              const found = page.documents.find(doc => 
                (doc.email && doc.email === email) || (doc.userId && doc.userId === targetUserId)
              );
              if (found) {
                console.log(`✅ Found user via paginated search after ${allDocs.length} documents scanned`);
                return found;
              }
            } catch (pageErr) {
              console.warn(`   ⚠️  Error paginating:`, pageErr.message);
              break;
            }
          }
          
          // If we've scanned all documents and still can't find it, the 409 might be a document ID conflict
          // Try creating again with a fresh document ID (maybe the first attempt partially failed)
          console.warn(`⚠️  User not found after all searches. 409 might be document ID conflict. Retrying with new document ID...`);
          try {
            // Switch to a brand-new userId to avoid unique constraint collisions
            const oldUserId = targetUserId;
            targetUserId = generateUserId();
            console.warn(`   ⚠️  Switching userId from "${oldUserId}" to "${targetUserId}" to avoid conflicts`);
            const newDocId = ID.unique();
            const retryDoc = await awDatabases.createDocument(
              APPWRITE_DATABASE_ID,
              APPWRITE_USERS_COLLECTION_ID,
              newDocId,
              buildUserDocumentPayload()
            );
            console.log(`✅ Successfully created user on retry with new document ID: ${newDocId}`);
            
            // Wait a bit and verify
            await new Promise(resolve => setTimeout(resolve, 300));
            const verifyUser = await getUserById(targetUserId) || await getUserByEmail(email);
            if (verifyUser) {
              return verifyUser;
            }
            // Return the created doc even if we can't verify it yet
            return retryDoc;
          } catch (retryErr) {
            await deleteDocIfExists(typeof newDocId !== 'undefined' ? newDocId : null);
            // If retry also fails with 409, it's definitely a unique constraint (email/userId exists)
            if (retryErr.code === 409 && !retryErr.message?.includes('requested ID already exists')) {
              console.warn(`⚠️  Retry also got 409 (not document ID conflict). User likely exists but not queryable.`);
              console.warn(`   Returning null - caller should handle this gracefully.`);
              // Return null - the POST endpoint will handle this
              return null;
            }
            // If it's a different error, throw it
            console.error(`❌ User creation failed after retry:`, retryErr.message);
            throw retryErr;
          }
        }
        
        // Check if roles attribute is wrong type (String instead of Array)
        if (e.message?.includes('roles') && e.message?.includes('must be a valid string')) {
          console.error(`❌ Error: The "roles" attribute in users collection is configured as String instead of String Array.`);
          console.error(`   Please delete the "roles" attribute in Appwrite Console and recreate it as a String Array.`);
          console.error(`   See MANUAL_ATTRIBUTE_SETUP.md for correct attribute configuration.`);
          return null;
        }
        
        // If datetime attributes don't exist, try without them
        if (e.message?.includes('createdAt') || e.message?.includes('updatedAt') || e.message?.includes('Unknown attribute')) {
          try {
            // Use ID.unique() to generate a unique document ID
            // IMPORTANT: Always use ID.unique() to avoid document ID conflicts
            const docId = ID.unique();
            const doc = await awDatabases.createDocument(
              APPWRITE_DATABASE_ID,
              APPWRITE_USERS_COLLECTION_ID,
              docId,
              buildUserDocumentPayload(false)
            );
            console.log(`✅ Successfully created user (without datetime) with document ID: ${docId}`);
            
            // Add delay to allow index sync, then verify user exists
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify the user exists
            try {
              const verifyUser = await getUserById(targetUserId) || await getUserByEmail(email);
              if (verifyUser) {
                return verifyUser;
              }
              // Fallback: list all users and find by document ID
              const allUsers = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_USERS_COLLECTION_ID,
                [],
                100
              );
              const foundDoc = allUsers.documents.find(d => d.$id === docId);
              if (foundDoc) {
                return foundDoc;
              }
            } catch (verifyErr) {
              // Return doc anyway since creation succeeded
            }
            
            return doc;
          } catch (e2) {
            // Check if roles attribute is wrong type
            if (e2.message?.includes('roles') && e2.message?.includes('must be a valid string')) {
              console.error(`❌ Error: The "roles" attribute in users collection is configured as String instead of String Array.`);
              console.error(`   Please delete the "roles" attribute in Appwrite Console and recreate it as a String Array.`);
              console.error(`   See MANUAL_ATTRIBUTE_SETUP.md for correct attribute configuration.`);
              return null;
            }
            // If userId attribute doesn't exist, collection isn't ready
            if (e2.message?.includes('userId') || e2.message?.includes('Unknown attribute')) {
              console.warn(`⚠️  Users collection missing required attributes. Please run migration or create attributes manually.`);
              console.warn(`   See MANUAL_ATTRIBUTE_SETUP.md for instructions`);
              return null;
            }
            throw e2;
          }
        }
        throw e;
      }
    }
  } catch (err) {
    // If collection doesn't exist, return null (migration not run)
    if (err.code === 404 || err.type === 'collection_not_found') {
      console.warn('⚠️  Users collection not found. Please run migration: node migrate_create_users_collection.js');
      return null;
    }
    
    // Handle document ID conflict (409 error)
    if (err.code === 409 || err.message?.includes('already exists') || err.message?.includes('requested ID already exists')) {
      console.warn(`⚠️  Document conflict for userId "${targetUserId}". Checking if user already exists...`);
      
      // Try multiple times with increasing delays (index might not be ready)
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // 500ms, 1000ms delays
        }
        
        // Try to get existing user by userId
        const existing = await getUserById(targetUserId);
        if (existing) {
          console.log(`✅ Found existing user for userId "${targetUserId}" (attempt ${attempt + 1}), returning existing record`);
          return existing;
        }
        
        // Try by email
        const existingByEmail = await getUserByEmail(email);
        if (existingByEmail) {
          console.log(`✅ Found existing user for email "${email}" (attempt ${attempt + 1}), returning existing record`);
          return existingByEmail;
        }
      }
      
      // If still not found after multiple attempts, try listing all users to find matches
      try {
        const allUsers = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          [],
          100
        );
        const matchingUsers = allUsers.documents.filter(doc => 
          (doc.userId && doc.userId === targetUserId) || (doc.email && doc.email === email)
        );
        if (matchingUsers.length > 0) {
          console.log(`✅ Found ${matchingUsers.length} matching user(s) via list query, returning first match`);
          const matched = matchingUsers[0];
          // If userId is NULL, update it
          if (!matched.userId && targetUserId) {
            try {
              await awDatabases.updateDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_USERS_COLLECTION_ID,
                matched.$id,
                { userId: targetUserId }
              );
              matched.userId = targetUserId;
            } catch (updateErr) {
              console.warn(`⚠️  Could not update userId:`, updateErr.message);
            }
          }
          return matched;
        }
      } catch (listErr) {
        console.warn(`⚠️  Could not list users for debugging:`, listErr.message);
      }
      
      // Final attempt: try creating with a completely different approach
      // Generate a completely new unique document ID and try once more
      console.warn(`⚠️  Attempting final creation with alternative approach...`);
      
      // One more comprehensive check before final attempt
      try {
        const finalCheck = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          [],
          100
        );
        const finalMatch = finalCheck.documents.find(doc => 
          (doc.email && doc.email === email) || (doc.userId && doc.userId === targetUserId)
        );
        if (finalMatch) {
          console.log(`✅ Found user in final check before creation attempt`);
          if (!finalMatch.userId && targetUserId) {
            try {
              await awDatabases.updateDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_USERS_COLLECTION_ID,
                finalMatch.$id,
                { userId: targetUserId }
              );
              finalMatch.userId = targetUserId;
            } catch (updateErr) {
              // Ignore update errors
            }
          }
          return finalMatch;
        }
      } catch (finalCheckErr) {
        // Ignore final check errors
      }
      
      // Add delay before final attempt
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        const { ID } = require('node-appwrite');
        // Generate a completely unique document ID
        // IMPORTANT: Always use ID.unique() - if this fails, it's likely a unique constraint on userId/email
        const finalDocId = ID.unique();
        console.log(`🔄 Final creation attempt with document ID: ${finalDocId}, userId: ${targetUserId}, email: ${email}`);
        const finalDoc = await awDatabases.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          finalDocId,
          {
            userId: targetUserId,
            email,
            name: name || email,
            roles: [],
            createdAt: new Date().toISOString()
          }
        );
        console.log(`✅ Successfully created user with final attempt (document ID: ${finalDocId})`);
        
        // Add delay to allow index sync, then verify user exists
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify the user exists
        try {
        const verifyUser = await getUserById(targetUserId) || await getUserByEmail(email);
          if (verifyUser) {
            return verifyUser;
          }
          // Fallback: list all users and find by document ID
          const allUsers = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_USERS_COLLECTION_ID,
            [],
            100
          );
          const foundDoc = allUsers.documents.find(d => d.$id === finalDocId);
          if (foundDoc) {
            console.log(`✅ Verified user exists via list query after final creation`);
            return foundDoc;
          }
        } catch (verifyErr) {
          console.warn(`⚠️  Could not verify user after final creation, but creation succeeded`);
          // Return doc anyway since creation succeeded
        }
        
        return finalDoc;
      } catch (finalErr) {
        // If final attempt fails, it's definitely a unique constraint issue
        console.error(`❌ Persistent conflict: Cannot create user with userId "${targetUserId}" and email "${email}"`);
        console.error(`   Error: ${finalErr.message || finalErr}`);
        console.error(`   Error code: ${finalErr.code || 'unknown'}`);
        
        // One last attempt to find the user
        try {
          const lastCheck = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_USERS_COLLECTION_ID,
            [],
            100
          );
          const lastMatch = lastCheck.documents.find(doc => 
            (doc.email && doc.email === email) || (doc.userId && doc.userId === targetUserId)
          );
          if (lastMatch) {
            console.log(`✅ Found user after final creation failure, returning existing record`);
            return lastMatch;
          }
        } catch (lastCheckErr) {
          // Ignore
        }
        
        console.error(`   Possible causes:`);
        console.error(`   1. Unique index constraint violation (userId "${targetUserId}" or email "${email}" already exists)`);
        console.error(`   2. Database index not fully synchronized`);
        console.error(`   3. Query timing issue - user exists but not queryable yet`);
        console.error(`   Recommendation: Check Appwrite Console manually for users with this email or userId`);
        return null;
      }
    }
    
    // Check for roles attribute type error
    if (err.message?.includes('roles') && err.message?.includes('must be a valid string')) {
      console.error('Error ensuring user record: Invalid document structure: Attribute "roles" has invalid format. Value must be a valid string and no longer than 255 chars');
      console.error(`❌ Error: The "roles" attribute in users collection is configured as String instead of String Array.`);
      console.error(`   Please delete the "roles" attribute in Appwrite Console and recreate it as a String Array.`);
      console.error(`   See MANUAL_ATTRIBUTE_SETUP.md for correct attribute configuration.`);
      return null;
    }
    
    console.error('Error ensuring user record:', err.message || err);
    return null;
  }
}

async function setUserRoles(userId, rolesArray) {
  if (!awDatabases || !APPWRITE_DATABASE_ID) {
    console.warn('⚠️  Appwrite not configured, cannot set user roles');
    return false;
  }
  try {
    console.log(`🔧 Setting roles for user ${userId}:`, rolesArray);
    let user = await getUserById(userId);
    
    // If not found, try multiple times with increasing delays (index sync)
    if (!user) {
      const maxRetries = 5;
      const delays = [300, 500, 1000, 2000, 3000];
      for (let attempt = 0; attempt < maxRetries && !user; attempt++) {
        if (attempt > 0) {
          console.log(`   Retry ${attempt}/${maxRetries - 1}: Waiting ${delays[attempt - 1]}ms for index sync...`);
          await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
        }
        user = await getUserById(userId);
        if (user) {
          console.log(`✅ Found user after ${attempt + 1} attempt(s)`);
          break;
        }
      }
    }
    
    // If still not found, try listing all users (no index dependency)
    if (!user) {
      try {
        console.log(`   Trying comprehensive list search...`);
        let allUsers = [];
        let offset = 0;
        const pageSize = 100;
        let hasMore = true;
        
        while (hasMore && allUsers.length < 1000 && !user) {
          const page = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_USERS_COLLECTION_ID,
            [],
            pageSize,
            offset
          );
          allUsers = allUsers.concat(page.documents);
          hasMore = page.documents.length === pageSize;
          offset += pageSize;
          
          user = page.documents.find(doc => doc.userId === userId);
          if (user) {
            console.log(`✅ Found user via list search after scanning ${allUsers.length} documents`);
            break;
          }
        }
      } catch (listErr) {
        console.warn(`   ⚠️  List search failed:`, listErr.message);
      }
    }
    
    if (!user) {
      console.warn(`❌ User ${userId} not found after multiple attempts and comprehensive search`);
      return false;
    }
    
    const oldRoles = Array.isArray(user.roles) ? [...user.roles] : [];
    const newRoles = Array.isArray(rolesArray) ? rolesArray : [];
    
    const { ID } = require('node-appwrite');
    try {
      await awDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_USERS_COLLECTION_ID,
        user.$id,
        {
          roles: newRoles,
          updatedAt: new Date().toISOString()
        }
      );
    } catch (e) {
      // Check if roles attribute is wrong type (String instead of Array)
      if (e.message?.includes('roles') && e.message?.includes('must be a valid string')) {
        console.error(`❌ Error: The "roles" attribute in users collection is configured as String instead of String Array.`);
        console.error(`   Please delete the "roles" attribute in Appwrite Console and recreate it as a String Array.`);
        console.error(`   See MANUAL_ATTRIBUTE_SETUP.md for correct attribute configuration.`);
        return false;
      }
      // Try without updatedAt
      try {
        await awDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          user.$id,
          {
            roles: newRoles
          }
        );
      } catch (e2) {
        if (e2.message?.includes('roles') && e2.message?.includes('must be a valid string')) {
          console.error(`❌ Error: The "roles" attribute in users collection is configured as String instead of String Array.`);
          console.error(`   Please delete the "roles" attribute in Appwrite Console and recreate it as a String Array.`);
          console.error(`   See MANUAL_ATTRIBUTE_SETUP.md for correct attribute configuration.`);
          return false;
        }
        throw e2;
      }
    }
    
    // Audit log
    await logRoleChange(userId, 'system', oldRoles, newRoles);
    
    return true;
  } catch (err) {
    console.error('Error setting user roles:', err);
    return false;
  }
}

async function isUserInRole(userId, role) {
  const user = await getUserById(userId);
  if (!user || !user.roles) {
    return false;
  }
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.includes(role) || roles.includes('super_admin'); // super_admin has all permissions
}

// Helper to check if users collection exists
async function checkUsersCollectionExists() {
  if (!awDatabases || !APPWRITE_DATABASE_ID) {
    return false;
  }
  try {
    await awDatabases.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_USERS_COLLECTION_ID, [], 1);
    return true;
  } catch (err) {
    return false;
  }
}

async function logRoleChange(userId, changedBy, oldRoles, newRoles) {
  if (!awDatabases || !APPWRITE_DATABASE_ID) {
    console.log(`📝 [AUDIT] Role change: ${userId} by ${changedBy}, ${JSON.stringify(oldRoles)} -> ${JSON.stringify(newRoles)}`);
    return;
  }
  try {
    const { ID } = require('node-appwrite');
    await awDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_ROLE_CHANGES_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        changedBy,
        oldRoles: Array.isArray(oldRoles) ? oldRoles : [],
        newRoles: Array.isArray(newRoles) ? newRoles : [],
        createdAt: new Date().toISOString()
      }
    );
  } catch (err) {
    // Check if oldRoles/newRoles attributes are wrong type (String instead of Array)
    if (err.message?.includes('oldRoles') || err.message?.includes('newRoles')) {
      if (err.message?.includes('must be a valid string')) {
        console.error(`❌ Error: The "oldRoles" or "newRoles" attributes in roleChanges collection are configured as String instead of String Array.`);
        console.error(`   Please delete these attributes in Appwrite Console and recreate them as String Arrays.`);
        console.error(`   See MANUAL_ATTRIBUTE_SETUP.md for correct attribute configuration.`);
      }
    }
    // Fallback to console log
    console.log(`📝 [AUDIT] Role change: ${userId} by ${changedBy}, ${JSON.stringify(oldRoles)} -> ${JSON.stringify(newRoles)}`);
  }
}

// Token authorization helper
async function authorizeSocketToken(token) {
  // For dev: if token matches ADMIN_SHARED_SECRET, map to super_admin
  if (token === ADMIN_SHARED_SECRET) {
    // In dev mode we no longer auto-create the dev-admin record in Appwrite.
    // Instead return an in-memory super_admin user so the DB isn't mutated implicitly.
    return { userId: 'dev-admin', email: 'dev@admin.local', roles: ['super_admin'] };
  }
  
  // TODO: For production, validate Appwrite session token here
  // const { Account } = require('node-appwrite');
  // const account = new Account(awClient);
  // const session = await account.getSession('current');
  // return { userId: session.userId, email: session.email };
  
  return null;
}

// Authentication middleware
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.substring(7);
  
  // For dev: map ADMIN_SHARED_SECRET to super_admin
  if (token === ADMIN_SHARED_SECRET) {
    // Dev mode: just set an in-memory super_admin user. Do not auto-create in Appwrite.
    req.user = { userId: 'dev-admin', email: 'dev@admin.local', roles: ['super_admin'] };
    return next();
  }
  
  // TODO: For production, validate Appwrite session token
  // const authResult = await authorizeSocketToken(token);
  // if (!authResult) {
  //   return res.status(401).json({ error: 'Invalid token' });
  // }
  // req.user = authResult;
  // return next();
  
  // For now, reject unknown tokens
  return res.status(401).json({ error: 'Invalid token' });
}

// Role-based authorization middleware factory
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return async (req, res, next) => {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userId = req.user.userId;
    
    // Check if user has roles in req.user (for dev mode fallback)
    if (req.user.roles && Array.isArray(req.user.roles)) {
      const hasRole = roles.some(role => req.user.roles.includes(role) || req.user.roles.includes('super_admin'));
      if (hasRole) {
        return next();
      }
    }
    
    // Otherwise check via database
    let hasRole = false;
    try {
      for (const role of roles) {
        if (await isUserInRole(userId, role)) {
          hasRole = true;
          break;
        }
      }
    } catch (err) {
      // If collection doesn't exist, allow if user has roles in req.user (dev mode)
      if (req.user.roles && Array.isArray(req.user.roles)) {
        hasRole = roles.some(role => req.user.roles.includes(role) || req.user.roles.includes('super_admin'));
      }
    }
    
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Legacy admin auth (now uses RBAC)
function requireAdminAuth(req, res, next) {
  requireAuth(req, res, () => {
    requireRole(['admin', 'super_admin'])(req, res, next);
  });
}

// ============================================================================
// END OF RBAC IMPLEMENTATION
// ============================================================================

// Encryption helper: Encrypt sensitive field
function encryptField(plaintext) {
  if (!ENCRYPTION_ENABLED || !plaintext) {
    return null;
  }
  try {
    const encrypted = encryption.encryptPayload(plaintext, MASTER_KEY_BASE64);
    return encryption.formatForStorage(encrypted);
  } catch (err) {
    console.error('❌ Encryption failed:', err.message);
    return null;
  }
}

// Decryption helper: Decrypt sensitive field
function decryptField(encryptedField) {
  if (!encryption || !encryptedField) {
    return null;
  }
  
  // Check if field is encrypted
  if (!encryption.isEncrypted(encryptedField)) {
    // Legacy plaintext - return as-is (for backward compatibility)
    return typeof encryptedField === 'string' ? encryptedField : null;
  }
  
  if (!MASTER_KEY_BASE64) {
    console.warn('⚠️  Cannot decrypt: MASTER_KEY_BASE64 not set');
    return '[ENCRYPTED]';
  }
  
  try {
    const parsed = encryption.parseFromStorage(encryptedField);
    return encryption.decryptPayload(parsed, MASTER_KEY_BASE64);
  } catch (err) {
    console.error('❌ Decryption failed:', err.message);
    return '[DECRYPTION_FAILED]';
  }
}

// Appwrite helper: Ensure session exists
async function ensureSessionInAppwrite(sessionId, userMeta = {}) {
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
    console.error(`❌ Cannot create session: Appwrite not configured`);
    console.error(`   awDatabases: ${!!awDatabases}, DB_ID: ${!!APPWRITE_DATABASE_ID}, SESSIONS_COLL_ID: ${!!APPWRITE_SESSIONS_COLLECTION_ID}`);
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
    
    await awDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_SESSIONS_COLLECTION_ID,
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
              await awDatabases.createDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_SESSIONS_COLLECTION_ID,
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
          console.error(`      APPWRITE_DATABASE_ID: ${APPWRITE_DATABASE_ID ? '✅ Set' : '❌ Missing'}`);
          console.error(`      APPWRITE_SESSIONS_COLLECTION_ID: ${APPWRITE_SESSIONS_COLLECTION_ID ? '✅ Set' : '❌ Missing'}`);
        }
        
        return false;
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
  console.log(`🔍 saveMessageToAppwrite called: sessionId=${sessionId}, sender=${sender}, textLength=${text?.length || 0}`);
  console.log(`🔍 Appwrite check: awDatabases=${!!awDatabases}, DB_ID=${!!APPWRITE_DATABASE_ID}, MSG_COLL_ID=${!!APPWRITE_MESSAGES_COLLECTION_ID}`);
  
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
    if (!APPWRITE_DATABASE_ID) {
      console.error(`❌ Cannot save message: APPWRITE_DATABASE_ID is not set in .env`);
    } else if (!APPWRITE_MESSAGES_COLLECTION_ID) {
      console.error(`❌ Cannot save message: APPWRITE_MESSAGES_COLLECTION_ID is not set in .env`);
    } else if (!awDatabases) {
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
        await awDatabases.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_SESSIONS_COLLECTION_ID,
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
    const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
    
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
    messageDoc.metadata = metadataStr || '{}'; // Ensure metadata is always a string
    
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
    
    console.log(`📤 Creating document in Appwrite: DB=${APPWRITE_DATABASE_ID}, COLL=${APPWRITE_MESSAGES_COLLECTION_ID}`);
    console.log(`📤 Document data keys: ${Object.keys(messageDoc).join(', ')}`);
    console.log(`📤 Text field present: ${!!messageDoc.text}, Text length: ${messageDoc.text?.length || 0}`);
    
    const result = await awDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_MESSAGES_COLLECTION_ID,
      'unique()',
      messageDoc
    );
    console.log(`✅ Saved message to Appwrite: ${sessionId} (${sender}) [Doc ID: ${result.$id}]`);
    if (ENCRYPTION_ENABLED && messageDoc.encrypted) {
      console.log(`   🔒 Message encrypted (encrypted field present)`);
    }
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
    console.error(`   Encryption enabled: ${ENCRYPTION_ENABLED}`);
    
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
      console.error(`   Full error message: ${err?.message || 'No message'}`);
      console.error(`   Error response: ${JSON.stringify(err?.response || {})}`);
      if (err?.message?.includes('createdAt')) {
        console.error(`   🔧 Fix: Add createdAt attribute to messages collection in Appwrite Console`);
      }
      if (err?.message?.includes('text')) {
        console.error(`   🔧 Fix: Check 'text' attribute exists and is of type 'string' in messages collection`);
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

// ============================================================================
// Accuracy Logging Implementation
// ============================================================================

// PII Redaction helper (simple pattern matching)
function redactPII(text) {
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
async function saveAccuracyRecord(sessionId, messageId, aiText, confidence, latencyMs, tokens, responseType, metadata = {}) {
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
    console.warn('⚠️  Appwrite not configured, cannot save accuracy record');
    return null;
  }
  
  // Prepare data outside try block so it's accessible in catch block for retry
  let truncatedText = aiText || '';
  if (truncatedText.length > 10000) {
    truncatedText = truncatedText.substring(0, 10000) + '...[truncated]';
  }
  truncatedText = redactPII(truncatedText);
  
  const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
  
  try {
    
    // Build accuracy document with only required fields first
    // Optional fields (responseType, messageId) will be added only if collection supports them
    const accuracyDoc = {
      sessionId: sessionId,
      aiText: truncatedText,
      confidence: confidence !== undefined && confidence !== null ? confidence : null,
      tokens: tokens !== undefined && tokens !== null ? tokens : null,
      latencyMs: latencyMs !== undefined && latencyMs !== null ? latencyMs : null,
      humanMark: null, // Will be set via feedback endpoints
      evaluation: null, // Will be set via admin evaluation
      createdAt: new Date().toISOString(),
      metadata: metadataStr
    };
    
    // Only add optional fields if provided (collection may not have these attributes)
    if (responseType) {
      accuracyDoc.responseType = responseType; // "ai" | "fallback" | "stub"
    }
    if (messageId) {
      accuracyDoc.messageId = messageId;
    }
    
    // Remove any null/undefined values that might cause Appwrite validation errors
    Object.keys(accuracyDoc).forEach(key => {
      if (accuracyDoc[key] === null || accuracyDoc[key] === undefined) {
        delete accuracyDoc[key];
      }
    });
    
    const { ID } = require('node-appwrite');
    const result = await awDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_AI_ACCURACY_COLLECTION_ID,
      ID.unique(),
      accuracyDoc
    );
    
    console.log(`📊 Accuracy record saved: ${sessionId} (${responseType || 'ai'}, ${latencyMs}ms, conf: ${confidence})`);
    return result.$id;
  } catch (err) {
    // Gracefully handle errors - don't crash the app
    const errorMsg = err.message || String(err);
    console.warn(`⚠️  Failed to save accuracy record:`, errorMsg);
    // Check if collection exists or has schema issues
    if (err.code === 404) {
      console.warn(`   💡 Run migration: node migrate_create_ai_accuracy_collection.js`);
    } else if (err.code === 400 && errorMsg.includes('Unknown attribute')) {
      // Extract the attribute name from error message (try multiple formats)
      let unknownAttr = errorMsg.match(/Unknown attribute: "([^"]+)"/)?.[1] ||
                       errorMsg.match(/Unknown attribute: '([^']+)'/)?.[1] ||
                       errorMsg.match(/Unknown attribute: (\w+)/)?.[1];
      
      if (!unknownAttr) {
        // Fallback: check which optional fields we tried to add
        if (responseType && errorMsg.includes('responseType')) unknownAttr = 'responseType';
        else if (messageId && errorMsg.includes('messageId')) unknownAttr = 'messageId';
      }
      
      if (unknownAttr) {
        console.warn(`   💡 Collection doesn't have '${unknownAttr}' attribute - retrying without it`);
      } else {
        console.warn(`   💡 Unknown attribute error detected - retrying with minimal fields only`);
      }
      
      // Retry without the unknown attribute
      try {
        // Rebuild document from scratch without the problematic field
        const retryDoc = {
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
        
        // Only add optional fields if they're not the problematic one
        if (unknownAttr) {
          // Explicitly exclude the problematic attribute
          if (responseType && unknownAttr !== 'responseType') {
            retryDoc.responseType = responseType;
          }
          if (messageId && unknownAttr !== 'messageId') {
            retryDoc.messageId = messageId;
          }
        } else {
          // If we couldn't identify the attribute, don't add any optional fields
          // (safest approach - only use required fields)
        }
        
        // Remove nulls
        Object.keys(retryDoc).forEach(key => {
          if (retryDoc[key] === null || retryDoc[key] === undefined) {
            delete retryDoc[key];
          }
        });
        
        const { ID } = require('node-appwrite');
        const result = await awDatabases.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_AI_ACCURACY_COLLECTION_ID,
          ID.unique(),
          retryDoc
        );
        console.log(`📊 Accuracy record saved (without ${unknownAttr || 'optional fields'}): ${sessionId}`);
        return result.$id;
      } catch (retryErr) {
        console.warn(`   ⚠️  Retry also failed:`, retryErr.message);
      }
    }
    return null;
  }
}

// Log accuracy audit entry
async function logAccuracyAudit(accuracyId, adminId, action, note = null) {
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_ACCURACY_AUDIT_COLLECTION_ID) {
    console.log(`📝 [AUDIT] Accuracy ${action}: ${accuracyId} by ${adminId}${note ? ` - ${note}` : ''}`);
    return;
  }
  
  try {
    const { ID } = require('node-appwrite');
    await awDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_ACCURACY_AUDIT_COLLECTION_ID,
      ID.unique(),
      {
        accuracyId,
        adminId,
        action, // "evaluate" | "feedback"
        note: note || null,
        ts: new Date().toISOString()
      }
    );
  } catch (err) {
    // Fallback to console log
    console.log(`📝 [AUDIT] Accuracy ${action}: ${accuracyId} by ${adminId}${note ? ` - ${note}` : ''}`);
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

  // Handle admin/widget joining session room for real-time updates
  socket.on('join_session', (data) => {
    const { sessionId } = data || {};
    if (sessionId && typeof sessionId === 'string') {
      socket.join(sessionId);
      const room = io.sockets.adapter.rooms.get(sessionId);
      const roomSize = room ? room.size : 0;
      console.log(`📱 Socket ${socket.id} joined session room: ${sessionId} (${roomSize} socket(s) total)`);
    } else {
      console.warn(`⚠️  Invalid join_session request from ${socket.id}:`, data);
    }
  });

  // Handle session start
  socket.on('start_session', async (data) => {
    const sessionId = data?.sessionId || socket.id;
    const userMeta = data?.userMeta || {};
    
    console.log(`📝 start_session event received: sessionId=${sessionId}`);
    const sessionCreated = await ensureSessionInAppwrite(sessionId, userMeta);
    if (!sessionCreated) {
      console.error(`❌ CRITICAL: Failed to create session [${sessionId}] - session will not appear in admin panel!`);
      // Still continue - messages might still work, but session won't be visible
    }
    
    // Join session room - this is critical for receiving agent messages
    socket.join(sessionId);
    
    // Verify room membership
    const room = io.sockets.adapter.rooms.get(sessionId);
    const roomSize = room ? room.size : 0;
    console.log(`📱 Socket ${socket.id} joined session room: ${sessionId} (${roomSize} socket(s) total)`);
    
    const welcomeMsg = "Hello! 👋 I'm your AI Customer Support Assistant. How can I help you today?";
    socket.emit('session_started', { sessionId });
    socket.emit('bot_message', { text: welcomeMsg, confidence: 1 });
    
    const welcomeStart = process.hrtime.bigint();
    console.log(`💾 Attempting to save welcome message to Appwrite...`);
    const welcomeSaveResult = await saveMessageToAppwrite(sessionId, 'bot', welcomeMsg, { confidence: 1 });
    const welcomeEnd = process.hrtime.bigint();
    const welcomeLatencyMs = Number(welcomeEnd - welcomeStart) / 1000000;
    if (!welcomeSaveResult) {
      console.error(`❌ CRITICAL: Failed to save welcome message [${sessionId}] - saveMessageToAppwrite returned false`);
    } else {
      console.log(`✅ Welcome message saved successfully [${sessionId}]`);
    }
    
    // Save accuracy record for welcome message
    await saveAccuracyRecord(
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

    // Ensure socket is in session room (in case of reconnection or room loss)
    // This is critical for receiving agent messages
    socket.join(sessionId);
    const roomAfterJoin = io.sockets.adapter.rooms.get(sessionId);
    const roomSizeAfterJoin = roomAfterJoin ? roomAfterJoin.size : 0;
    if (roomSizeAfterJoin > 0) {
      console.log(`📱 Socket ${socket.id} ensured in session room: ${sessionId} (${roomSizeAfterJoin} socket(s) total)`);
    }
    const trimmedText = text.trim();
    console.log(`💬 Message received [${sessionId}]: "${trimmedText.substring(0, 50)}${trimmedText.length > 50 ? '...' : ''}"`);

    // Always save user message to Appwrite
    console.log(`💾 Attempting to save user message to Appwrite...`);
    const saveResult = await saveMessageToAppwrite(sessionId, 'user', trimmedText);
    if (!saveResult) {
      console.error(`❌ CRITICAL: Failed to save user message [${sessionId}] - saveMessageToAppwrite returned false`);
      // Still continue with AI response even if save fails
    } else {
      console.log(`✅ User message saved successfully [${sessionId}]`);
    }

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
      const stubStart = process.hrtime.bigint();
      
      await saveMessageToAppwrite(sessionId, 'bot', stub, { confidence: 1 });
      
      const stubEnd = process.hrtime.bigint();
      const stubLatencyMs = Number(stubEnd - stubStart) / 1000000;
      
      // Save accuracy record for stub
      await saveAccuracyRecord(
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

    // Start latency timer early (BEFORE try block) so it's always accessible in catch block
    const latencyStart = process.hrtime.bigint();
    
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
      let messageDocId = null;
      let accuracyMetadata = {
        model: geminiModelName || 'unknown',
        modelVersion: geminiModelName || 'unknown',
        promptLength: conversationContext.length
      };
      
      try {
        result = await geminiModel.generateContent(conversationContext);
        response = await result.response;
        aiText = response.text() || 'Sorry, I could not produce an answer.';
        
        // Calculate latency
        const latencyEnd = process.hrtime.bigint();
        const latencyMs = Number(latencyEnd - latencyStart) / 1000000; // Convert nanoseconds to milliseconds
        
        // Try to extract tokens from response (if available)
        let tokens = null;
        try {
          if (response.usageMetadata) {
            tokens = response.usageMetadata.totalTokenCount || null;
          }
        } catch (tokenErr) {
          // Tokens not available, ignore
        }
        
        // Save message first to get messageId
        const messageSaved = await saveMessageToAppwrite(sessionId, 'bot', aiText, { confidence: 0.9 });
        
        // Get the message document ID if possible (we'll need to query for it)
        // For now, we'll save accuracy record without messageId and update later if needed
        // TODO: Improve this by returning messageId from saveMessageToAppwrite
        
        // Save accuracy record
        await saveAccuracyRecord(
          sessionId,
          null, // messageId - will be linked later if needed
          aiText,
          0.9,
          Math.round(latencyMs),
          tokens,
          'ai',
          {
            ...accuracyMetadata,
            aiRequestId: result.response?.promptFeedback?.blockReason || null
          }
        );
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
      
      // Calculate latency even for errors (latencyStart is defined outside try block)
      const latencyEnd = process.hrtime.bigint();
      const latencyMs = Number(latencyEnd - latencyStart) / 1000000;
      
      // Save fallback message
      await saveMessageToAppwrite(sessionId, 'bot', fallbackMsg, { confidence: 0, error: err?.message });
      
      // Save accuracy record for fallback
      await saveAccuracyRecord(
        sessionId,
        null,
        fallbackMsg,
        0,
        Math.round(latencyMs),
        null,
        'fallback',
        {
          model: geminiModelName || 'unknown',
          error: err?.message || 'Unknown error',
          errorCode: err?.code || err?.status || null
        }
      );
      
      io.to(sessionId).emit('bot_message', { text: fallbackMsg, confidence: 0 });
    }
  });

  // Agent connect handler
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
      
      // Use provided agentId or userId as agentId
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
  
  // Legacy agent_connect (for backward compatibility, but requires auth first)
  socket.on('agent_connect', async (data) => {
    const { agentId, token } = data || {};
    
    // If token provided, use agent_auth flow
    if (token) {
      socket.emit('agent_auth', { token, agentId });
      return;
    }
    
    // DEV MODE: Allow agent_connect without full auth if ADMIN_SHARED_SECRET is set
    // This allows admin panel to work in development without full RBAC setup
    if (!socket.data.authenticated && ADMIN_SHARED_SECRET) {
      console.log(`⚠️  DEV MODE: Allowing agent_connect without full auth for agentId: ${agentId}`);
      const finalAgentId = agentId || 'dev-agent';
      agentSockets.set(finalAgentId, socket.id);
      socket.join(`agents:${finalAgentId}`);
      socket.data.authenticated = true; // Mark as authenticated for dev mode
      socket.data.userId = finalAgentId; // Use agentId as userId in dev mode
      socket.data.agentId = finalAgentId;
      console.log(`👤 Agent connected (DEV MODE): ${finalAgentId} (socket: ${socket.id})`);
      socket.emit('agent_connected', { agentId: finalAgentId });
      return;
    }
    
    // Otherwise, check if already authenticated
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
    
    // Check authentication
    if (!socket.data.authenticated) {
      socket.emit('error', { error: 'Authentication required' });
      return;
    }
    
    // Verify agent has permission (skip in dev mode if ADMIN_SHARED_SECRET is set)
    const userId = socket.data.userId;
    let hasPermission = false;
    
    if (ADMIN_SHARED_SECRET) {
      // DEV MODE: Allow all agent takeovers
      hasPermission = true;
      console.log(`⚠️  DEV MODE: Skipping RBAC check for agent_takeover`);
    } else {
      // PRODUCTION: Check RBAC
      hasPermission = await isUserInRole(userId, 'agent') || 
                      await isUserInRole(userId, 'admin') || 
                      await isUserInRole(userId, 'super_admin');
    }
    
    if (!hasPermission) {
      socket.emit('error', { error: 'Insufficient permissions: agent role required' });
      return;
    }
    
    try {
      await assignAgentToSession(sessionId, agentId);
      socket.join(sessionId);
      
      // CRITICAL: Notify all sockets in session room (widget and admin) that agent joined
      io.to(sessionId).emit('agent_joined', { agentId, sessionId });
      console.log(`👤 Agent ${agentId} took over session ${sessionId}`);
      
      // Notify agent socket if online
      notifyAgentIfOnline(agentId, { type: 'assignment', sessionId });
      socket.emit('agent_takeover_success', { sessionId, agentId });
      
      // Ensure widget is in room - send a reminder to join if needed
      const room = io.sockets.adapter.rooms.get(sessionId);
      const roomSize = room ? room.size : 0;
      console.log(`   📊 Session room size after agent takeover: ${roomSize} socket(s)`);
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
      console.error(`❌ agent_message rejected: missing required fields`, { sessionId: !!sessionId, text: !!text, agentId: !!agentId });
      return;
    }
    
    // DEV MODE: Allow agent messages without full auth if ADMIN_SHARED_SECRET is set
    // This allows admin panel to work in development without full RBAC setup
    if (!socket.data.authenticated && ADMIN_SHARED_SECRET) {
      console.log(`⚠️  DEV MODE: Allowing agent_message without full auth for agentId: ${agentId}`);
      socket.data.authenticated = true;
      socket.data.userId = agentId;
      socket.data.agentId = agentId;
    }
    
    // Check authentication
    if (!socket.data.authenticated) {
      socket.emit('error', { error: 'Authentication required' });
      console.error(`❌ agent_message rejected: socket not authenticated`, { socketId: socket.id, agentId });
      return;
    }
    
    // Verify agent has permission (skip in dev mode if ADMIN_SHARED_SECRET is set)
    const userId = socket.data.userId;
    let hasPermission = false;
    
    if (ADMIN_SHARED_SECRET) {
      // DEV MODE: Allow all agent messages
      hasPermission = true;
      console.log(`⚠️  DEV MODE: Skipping RBAC check for agent message`);
    } else {
      // PRODUCTION: Check RBAC
      hasPermission = await isUserInRole(userId, 'agent') || 
                      await isUserInRole(userId, 'admin') || 
                      await isUserInRole(userId, 'super_admin');
    }
    
    if (!hasPermission) {
      socket.emit('error', { error: 'Insufficient permissions: agent role required' });
      console.error(`❌ agent_message rejected: insufficient permissions`, { userId, agentId });
      return;
    }
    
    console.log(`✅ Agent message accepted: agentId=${agentId}, sessionId=${sessionId}, text="${text.substring(0, 50)}..."`);
    
    // Save message to Appwrite with error handling - CRITICAL: Must save before broadcasting
    let saveSuccess = false;
    let saveError = null;
    try {
      console.log(`💾 Attempting to save agent message to Appwrite: sessionId=${sessionId}, sender=agent, text="${text.substring(0, 50)}..."`);
      saveSuccess = await saveMessageToAppwrite(sessionId, 'agent', text, { agentId });
      if (!saveSuccess) {
        console.error(`❌ Failed to save agent message to Appwrite for session ${sessionId} - saveMessageToAppwrite returned false`);
        saveError = new Error('saveMessageToAppwrite returned false');
      } else {
        console.log(`✅ Agent message saved to Appwrite: ${sessionId} (agent: ${agentId})`);
      }
    } catch (saveErr) {
      console.error(`❌ Exception saving agent message to Appwrite:`, saveErr?.message || saveErr);
      console.error(`   Stack:`, saveErr?.stack);
      saveError = saveErr;
      // Continue to broadcast even if save fails, so user sees the message
    }
    
    // If save failed, retry once after a short delay
    if (!saveSuccess && !saveError?.message?.includes('already exists')) {
      console.log(`🔄 Retrying agent message save after 500ms...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        saveSuccess = await saveMessageToAppwrite(sessionId, 'agent', text, { agentId });
        if (saveSuccess) {
          console.log(`✅ Agent message saved on retry: ${sessionId}`);
        } else {
          console.error(`❌ Agent message save failed on retry: ${sessionId}`);
        }
      } catch (retryErr) {
        console.error(`❌ Agent message save retry failed:`, retryErr?.message || retryErr);
      }
    }
    
    // Emit to session room for user widget and admin panel
    const messagePayload = { 
      text, 
      agentId, 
      sender: 'agent', 
      ts: Date.now(),
      sessionId // Include sessionId for widget identification
    };
    
    // Broadcast to session room (user widget and admin panel)
    // This ensures all sockets in the session room receive the message
    io.to(sessionId).emit('agent_message', messagePayload);
    
    // Also emit as a general message event for widget compatibility (some widgets listen to 'message')
    io.to(sessionId).emit('message', messagePayload);
    
    // Debug: Log room membership to help diagnose delivery issues
    const room = io.sockets.adapter.rooms.get(sessionId);
    const roomSize = room ? room.size : 0;
    console.log(`👤 Agent ${agentId} sent message to session ${sessionId}`);
    console.log(`   💾 Database save: ${saveSuccess ? '✅ Success' : '❌ Failed'}`);
    console.log(`   📤 Broadcasting to session room: ${sessionId} (${roomSize} socket(s) in room)`);
    
    // If no sockets in room, warn (user widget might not be connected or not joined room)
    if (roomSize === 0) {
      console.warn(`⚠️  No sockets found in room ${sessionId}, message may not reach user widget`);
      console.warn(`   💡 User widget should join room ${sessionId} on connection via 'start_session' event`);
      // Try to find any socket connected to this session and emit directly
      // This is a fallback for cases where room join didn't work
      try {
        const allSockets = await io.fetchSockets();
        let foundSocket = false;
        for (const s of allSockets) {
          if (s.rooms.has(sessionId)) {
            foundSocket = true;
            // Force emit directly to this socket as fallback
            s.emit('agent_message', messagePayload);
            console.log(`   🔄 Fallback: Emitted directly to socket ${s.id}`);
          }
        }
        if (!foundSocket) {
          console.warn(`   ⚠️  No sockets found with sessionId ${sessionId} in any room`);
          console.warn(`   💡 Widget may need to reconnect and join room ${sessionId}`);
        }
      } catch (fetchErr) {
        console.warn(`   ⚠️  Could not fetch sockets for fallback:`, fetchErr?.message);
      }
    } else {
      console.log(`   ✅ Message broadcast to ${roomSize} socket(s) in room`);
    }
    
    // Send success confirmation to agent socket
    socket.emit('agent_message_sent', { sessionId, success: true, saved: saveSuccess });
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

// GET /admin/sessions - List sessions with advanced filtering and pagination
app.get('/admin/sessions', requireAdminAuth, async (req, res) => {
  try {
    // Validate pagination params
    try {
      validatePaginationParams(req);
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }
    
    // Parse pagination params
    const { limit, offset } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });
    
    const { 
      status, 
      search, 
      agentId, 
      startDate, 
      endDate,
      fullTextSearch 
    } = req.query;
    
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
      return res.json({ items: [], total: 0, limit, offset, hasMore: false, message: 'Appwrite not configured' });
    }
    
    let queries = [];
    if (status && status.trim() !== '' && Query) {
      queries.push(Query.equal('status', status));
      console.log(`🔍 Filtering sessions by status: "${status}"`);
    }
    if (search && search.trim() !== '' && Query) {
      queries.push(Query.equal('sessionId', search));
      console.log(`🔍 Filtering sessions by sessionId search: "${search}"`);
    }
    if (startDate && Query) {
      try {
        const start = new Date(startDate);
        queries.push(Query.greaterThanEqual('startTime', start.toISOString()));
        console.log(`🔍 Filtering sessions from date: "${startDate}"`);
      } catch (e) {
        console.warn('Invalid startDate format:', startDate);
      }
    }
    if (endDate && Query) {
      try {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        queries.push(Query.lessThanEqual('startTime', end.toISOString()));
        console.log(`🔍 Filtering sessions until date: "${endDate}"`);
      } catch (e) {
        console.warn('Invalid endDate format:', endDate);
      }
    }
    
    console.log(`📋 Fetching sessions with ${queries.length} query filter(s), limit=${limit}, offset=${offset}`);
    
    // Add ordering: newest first (createdAt desc)
    // NOTE: For production, add index on createdAt (desc) in Appwrite Console for better performance
    // Index configuration: Attribute: $createdAt, Type: key, Order: desc
    if (Query && queries.length > 0) {
      queries.push(Query.orderDesc('$createdAt'));
    } else if (Query) {
      queries = [Query.orderDesc('$createdAt')];
    }
    
    let result;
    let totalCount = 0;
    try {
      // First, get total count (for pagination metadata)
      // Appwrite listDocuments returns total in the response
      result = await awDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        queries.length > 0 ? queries : undefined,
        limit,
        offset
      );
      totalCount = result.total;
      console.log(`✅ Backend returned ${result.total} total session(s), ${result.documents.length} in this page (offset=${offset})`);
    } catch (queryErr) {
      console.error(`❌ Query error:`, queryErr?.message || queryErr);
      // If query fails, try fetching all and filtering client-side
      console.log(`⚠️  Falling back to fetch-all-then-filter approach`);
      try {
        result = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_SESSIONS_COLLECTION_ID,
          undefined,
          10000 // Large limit to get all for filtering
        );
        totalCount = result.total;
        console.log(`✅ Fetched ${result.total} session(s) for client-side filtering`);
      } catch (fallbackErr) {
        console.error(`❌ Fallback also failed:`, fallbackErr?.message || fallbackErr);
        return res.json({ items: [], total: 0, limit, offset, hasMore: false, error: 'Failed to fetch sessions' });
      }
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
    
    // Client-side filtering for agentId (since it's in userMeta, not directly queryable)
    if (agentId && agentId.trim() !== '') {
      const beforeFilter = transformedSessions.length;
      transformedSessions = transformedSessions.filter(s => s.assignedAgent === agentId);
      console.log(`🔍 Agent filter: ${beforeFilter} → ${transformedSessions.length} sessions with agent="${agentId}"`);
    }
    
    // Client-side date filtering (fallback if backend query failed)
    if (startDate && (!queries.length || queries.length === 0)) {
      try {
        const start = new Date(startDate);
        const beforeFilter = transformedSessions.length;
        transformedSessions = transformedSessions.filter(s => {
          const sessionDate = s.startTime ? new Date(s.startTime) : (s.$createdAt ? new Date(s.$createdAt) : null);
          return sessionDate && sessionDate >= start;
        });
        console.log(`🔍 Start date filter: ${beforeFilter} → ${transformedSessions.length} sessions`);
      } catch (e) {
        console.warn('Invalid startDate for client-side filter:', startDate);
      }
    }
    
    if (endDate && (!queries.length || queries.length === 0)) {
      try {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const beforeFilter = transformedSessions.length;
        transformedSessions = transformedSessions.filter(s => {
          const sessionDate = s.startTime ? new Date(s.startTime) : (s.$createdAt ? new Date(s.$createdAt) : null);
          return sessionDate && sessionDate <= end;
        });
        console.log(`🔍 End date filter: ${beforeFilter} → ${transformedSessions.length} sessions`);
      } catch (e) {
        console.warn('Invalid endDate for client-side filter:', endDate);
      }
    }
    
    // Full-text search across messages (requires fetching messages)
    if (fullTextSearch && fullTextSearch.trim() !== '') {
      console.log(`🔍 Full-text search: "${fullTextSearch}"`);
      const searchTerm = fullTextSearch.toLowerCase();
      const matchingSessionIds = new Set();
      
      try {
        // Fetch messages in batches and search
        let messageOffset = 0;
        const messageLimit = 1000;
        let hasMoreMessages = true;
        
        while (hasMoreMessages && matchingSessionIds.size < 100) {
          let messageResult;
          try {
            if (Query) {
              messageResult = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_MESSAGES_COLLECTION_ID,
                undefined,
                messageLimit,
                messageOffset
              );
            } else {
              messageResult = await awDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_MESSAGES_COLLECTION_ID,
                undefined,
                messageLimit,
                messageOffset
              );
            }
            
            // Search in message text
            for (const msg of messageResult.documents) {
              const text = (msg.text || '').toLowerCase();
              if (text.includes(searchTerm)) {
                matchingSessionIds.add(msg.sessionId);
              }
            }
            
            messageOffset += messageResult.documents.length;
            hasMoreMessages = messageResult.documents.length === messageLimit;
          } catch (msgErr) {
            console.error('Error searching messages:', msgErr);
            break;
          }
        }
        
        // Filter sessions to only those with matching messages
        const beforeFilter = transformedSessions.length;
        transformedSessions = transformedSessions.filter(s => matchingSessionIds.has(s.sessionId));
        console.log(`🔍 Full-text search: ${beforeFilter} → ${transformedSessions.length} sessions with matching messages`);
      } catch (searchErr) {
        console.error('Full-text search error:', searchErr);
        // Continue without full-text filtering if search fails
      }
    }
    
    // If query failed and we fetched all, filter client-side on backend
    if (status && status.trim() !== '' && queries.length === 0) {
      const beforeFilter = transformedSessions.length;
      transformedSessions = transformedSessions.filter(s => s.status === status);
      console.log(`🔍 Backend client-side filter: ${beforeFilter} → ${transformedSessions.length} sessions with status="${status}"`);
    }
    
    // Apply pagination to filtered results (if we did client-side filtering)
    // If we used server-side pagination, result.documents already has the right slice
    let paginatedSessions;
    if (result.documents.length === transformedSessions.length && offset === 0) {
      // Server-side pagination worked, use as-is
      paginatedSessions = transformedSessions;
      totalCount = result.total; // Use server total
    } else {
      // Client-side filtering happened, apply pagination manually
      totalCount = transformedSessions.length;
      paginatedSessions = transformedSessions.slice(offset, offset + limit);
    }
    
    const paginationMeta = calculatePaginationMeta(totalCount, limit, offset);
    
    console.log(`📤 Sending ${paginatedSessions.length} session(s) to frontend (page ${paginationMeta.currentPage} of ${paginationMeta.totalPages})`);
    res.json({
      items: paginatedSessions,
      total: totalCount,
      limit,
      offset,
      hasMore: paginationMeta.hasMore,
      currentPage: paginationMeta.currentPage,
      totalPages: paginationMeta.totalPages
    });
  } catch (err) {
    console.error('Error listing sessions:', err);
    res.status(500).json({ error: err?.message || 'Failed to list sessions' });
  }
});

// GET /admin/sessions/:sessionId/messages - List messages for a session with pagination
app.get('/admin/sessions/:sessionId/messages', requireAdminAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { order = 'asc' } = req.query; // 'asc' (oldest first) or 'desc' (newest first)
    
    // Parse pagination params (default: load all for backward compatibility)
    // If no limit specified, load all messages (backward compatible)
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10) || 0;
    
    if (isNaN(limit) || limit <= 0) {
      // No limit = load all (backward compatible)
      limit = 10000;
    } else if (limit > 1000) {
      limit = 1000; // Max limit for messages
    }
    
    if (isNaN(offset) || offset < 0) {
      offset = 0;
    }
    
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
      return res.json({ items: [], total: 0, limit, offset, hasMore: false, message: 'Appwrite not configured' });
    }
    
    console.log(`📨 Fetching messages for session: ${sessionId}, limit=${limit}, offset=${offset}, order=${order}`);
    
    let result;
    const messageQueries = [];
    
    // Add sessionId filter
    if (Query) {
      messageQueries.push(Query.equal('sessionId', sessionId));
      
      // Add ordering
      // NOTE: For production, add index on sessionId + createdAt for better performance
      // Index configuration: Attributes: sessionId (string), createdAt (datetime), Order: asc
      if (order === 'desc') {
        messageQueries.push(Query.orderDesc('createdAt'));
      } else {
        messageQueries.push(Query.orderAsc('createdAt'));
      }
    }
    
    // Try Query class first if available
    if (Query && messageQueries.length > 0) {
      try {
        console.log(`🔍 Using Query class for messages query with pagination`);
        result = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_MESSAGES_COLLECTION_ID,
          messageQueries,
          limit,
          offset
        );
        console.log(`✅ Found ${result.total} total message(s) for session ${sessionId}, ${result.documents.length} in this page`);
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
        
        // Sort
        filteredDocs.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.$createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || b.$createdAt || 0).getTime();
          return order === 'desc' ? timeB - timeA : timeA - timeB;
        });
        
        // Apply pagination
        const total = filteredDocs.length;
        const paginated = filteredDocs.slice(offset, offset + limit);
        
        result = {
          documents: paginated,
          total: total
        };
        console.log(`✅ Found ${result.total} message(s) for session ${sessionId} using client-side filtering and pagination`);
      } catch (fallbackErr) {
        console.error(`❌ Failed to fetch messages:`, fallbackErr?.message || fallbackErr);
        console.error(`   Error code:`, fallbackErr?.code);
        console.error(`   Error type:`, fallbackErr?.type);
        throw new Error(`Failed to fetch messages: ${fallbackErr?.message || fallbackErr}`);
      }
    }
    
    // Sort by createdAt (if not already sorted by query)
    let sortedMessages = result.documents;
    if (!Query || messageQueries.length === 0) {
      sortedMessages = result.documents.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.$createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.$createdAt || 0).getTime();
        return order === 'desc' ? timeB - timeA : timeA - timeB;
      });
    }
    
    // Decrypt messages if encrypted
    const decryptedMessages = sortedMessages.map(msg => {
      const decrypted = { ...msg };
      
      // Decrypt text field
      if (msg.encrypted && encryption) {
        const decryptedText = decryptField(msg.encrypted);
        if (decryptedText) {
          decrypted.text = decryptedText;
        }
      } else if (!msg.text && msg.encrypted) {
        decrypted.text = '[ENCRYPTED]';
      }
      
      // Decrypt metadata field
      if (msg.encrypted_metadata && encryption) {
        const decryptedMetadata = decryptField(msg.encrypted_metadata);
        if (decryptedMetadata) {
          try {
            decrypted.metadata = JSON.parse(decryptedMetadata);
          } catch {
            decrypted.metadata = decryptedMetadata;
          }
        }
      } else if (msg.metadata && typeof msg.metadata === 'string') {
        try {
          decrypted.metadata = JSON.parse(msg.metadata);
        } catch {
          decrypted.metadata = msg.metadata;
        }
      }
      
      return decrypted;
    });
    
    // Log message types for debugging
    const messageTypes = decryptedMessages.reduce((acc, msg) => {
      acc[msg.sender || 'unknown'] = (acc[msg.sender || 'unknown'] || 0) + 1;
      return acc;
    }, {});
    console.log(`📊 Message types:`, messageTypes);
    
    // Calculate pagination metadata
    const total = result.total || decryptedMessages.length;
    const paginationMeta = calculatePaginationMeta(total, limit, offset);
    
    // Return paginated response (backward compatible: also include 'messages' key)
    res.json({
      items: decryptedMessages,
      messages: decryptedMessages, // Backward compatibility
      total,
      limit,
      offset,
      hasMore: paginationMeta.hasMore,
      currentPage: paginationMeta.currentPage,
      totalPages: paginationMeta.totalPages
    });
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

// ============================================================================
// ANALYTICS & METRICS ENDPOINTS
// ============================================================================

// In-memory cache for metrics (TTL 60s)
// TODO: Replace with Redis/Prometheus for production multi-instance deployments
const metricsCache = new LRUCache({
  max: 100,
  ttl: 60000 // 60 seconds
});

function getCacheKey(endpoint, params) {
  return `${endpoint}:${JSON.stringify(params)}`;
}

// Helper: Get date range with defaults
function getDateRange(from, to) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Helper: Stream messages with pagination (memory-efficient)
async function* streamAllMessages(startDate, endDate) {
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    try {
      let queries = [];
      if (Query && startDate) {
        queries.push(Query.greaterThanEqual('createdAt', startDate.toISOString()));
      }
      if (Query && endDate) {
        queries.push(Query.lessThanEqual('createdAt', endDate.toISOString()));
      }
      
      const result = await awDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_MESSAGES_COLLECTION_ID,
        queries.length > 0 ? queries : undefined,
        limit,
        offset
      );
      
      for (const msg of result.documents) {
        yield msg;
      }
      
      offset += result.documents.length;
      hasMore = result.documents.length === limit;
    } catch (err) {
      console.error('Error streaming messages:', err);
      break;
    }
  }
}

// Helper: Stream sessions with pagination
async function* streamAllSessions(startDate, endDate) {
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    try {
      let queries = [];
      if (Query && startDate) {
        queries.push(Query.greaterThanEqual('startTime', startDate.toISOString()));
      }
      if (Query && endDate) {
        queries.push(Query.lessThanEqual('startTime', endDate.toISOString()));
      }
      
      const result = await awDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        queries.length > 0 ? queries : undefined,
        limit,
        offset
      );
      
      for (const session of result.documents) {
        yield session;
      }
      
      offset += result.documents.length;
      hasMore = result.documents.length === limit;
    } catch (err) {
      console.error('Error streaming sessions:', err);
      break;
    }
  }
}

// GET /admin/metrics/overview - Overview metrics
app.get('/admin/metrics/overview', requireAdminAuth, async (req, res) => {
  const { from, to } = req.query;
  const authHeader = req.headers.authorization;
  const adminToken = authHeader ? authHeader.substring(7) : 'unknown';
  
  const cacheKey = getCacheKey('overview', { from, to });
  const cached = metricsCache.get(cacheKey);
  if (cached) {
    console.log(`📊 [CACHE HIT] Overview metrics`);
    return res.json(cached);
  }
  
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
    return res.status(503).json({ error: 'Appwrite not configured' });
  }
  
  const { start, end } = getDateRange(from, to);
  console.log(`📊 Computing overview metrics: ${start.toISOString()} to ${end.toISOString()}`);
  
  try {
    let totalSessions = 0;
    let totalMessages = 0;
    let sessionsWithMessages = new Set();
    let humanTakeoverCount = 0;
    let aiFallbackCount = 0;
    let botResponseTimes = [];
    
    // Track session status breakdown
    const statusCounts = {
      active: 0,
      agent_assigned: 0,
      closed: 0,
      needs_human: 0
    };
    
    // Count sessions
    for await (const session of streamAllSessions(start, end)) {
      totalSessions++;
      
      // Track status
      const status = (session.status || 'active').toLowerCase();
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      } else {
        statusCounts.active++; // Default to active for unknown statuses
      }
      
      // Check for human takeover (agent assigned)
      let assignedAgent = session.assignedAgent;
      if (!assignedAgent && session.userMeta) {
        try {
          const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta;
          assignedAgent = userMeta?.assignedAgent;
        } catch (e) {}
      }
      if (assignedAgent) {
        humanTakeoverCount++;
        // Also count as agent_assigned if status isn't already set
        if (status !== 'agent_assigned' && status !== 'closed') {
          statusCounts.active = Math.max(0, statusCounts.active - 1);
          statusCounts.agent_assigned++;
        }
      }
    }
    
    // Count messages and compute response times
    const sessionMessages = new Map(); // sessionId -> [{sender, createdAt, ...}]
    
    for await (const msg of streamAllMessages(start, end)) {
      totalMessages++;
      sessionsWithMessages.add(msg.sessionId);
      
      if (!sessionMessages.has(msg.sessionId)) {
        sessionMessages.set(msg.sessionId, []);
      }
      sessionMessages.get(msg.sessionId).push({
        sender: msg.sender,
        createdAt: new Date(msg.createdAt || msg.$createdAt || Date.now()),
        confidence: msg.confidence
      });
    }
    
    // Compute bot response times (user message -> next bot message)
    for (const [sessionId, messages] of sessionMessages.entries()) {
      const sorted = messages.sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].sender === 'user' && sorted[i + 1].sender === 'bot') {
          const responseTime = sorted[i + 1].createdAt - sorted[i].createdAt;
          if (responseTime > 0 && responseTime < 300000) { // Max 5 minutes
            botResponseTimes.push(responseTime);
          }
        }
      }
    }
    
    const avgMessagesPerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;
    const avgBotResponseTimeMs = botResponseTimes.length > 0 
      ? botResponseTimes.reduce((a, b) => a + b, 0) / botResponseTimes.length 
      : 0;
    const humanTakeoverRate = totalSessions > 0 ? humanTakeoverCount / totalSessions : 0;
    
    // Count AI fallbacks (messages with low confidence or needsHuman flag)
    for (const [sessionId, messages] of sessionMessages.entries()) {
      for (const msg of messages) {
        if (msg.sender === 'bot' && msg.confidence !== null && msg.confidence < 0.5) {
          aiFallbackCount++;
        }
      }
    }
    
    const result = {
      totalSessions,
      totalMessages,
      avgMessagesPerSession: Math.round(avgMessagesPerSession * 100) / 100,
      avgBotResponseTimeMs: Math.round(avgBotResponseTimeMs),
      humanTakeoverRate: Math.round(humanTakeoverRate * 10000) / 100, // Percentage
      aiFallbackCount,
      sessionStatuses: statusCounts, // Include status breakdown
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
    
    metricsCache.set(cacheKey, result);
    logExportAction(adminToken, ['metrics'], 'overview');
    
    res.json(result);
  } catch (err) {
    console.error('Error computing overview metrics:', err);
    res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
  }
});

// GET /admin/metrics/messages-over-time - Time series data
app.get('/admin/metrics/messages-over-time', requireAdminAuth, async (req, res) => {
  const { from, to, interval = 'day' } = req.query;
  const authHeader = req.headers.authorization;
  const adminToken = authHeader ? authHeader.substring(7) : 'unknown';
  
  const cacheKey = getCacheKey('messages-over-time', { from, to, interval });
  const cached = metricsCache.get(cacheKey);
  if (cached) {
    console.log(`📊 [CACHE HIT] Messages over time`);
    return res.json(cached);
  }
  
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
    return res.status(503).json({ error: 'Appwrite not configured' });
  }
  
  const { start, end } = getDateRange(from, to);
  console.log(`📊 Computing messages-over-time: ${start.toISOString()} to ${end.toISOString()}, interval=${interval}`);
  
  try {
    const buckets = new Map(); // date -> { messages: 0, sessionsStarted: 0 }
    const sessionStartDates = new Set(); // sessionId -> date (to avoid double counting)
    
    // Initialize buckets based on interval
    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      buckets.set(dateKey, { messages: 0, sessionsStarted: 0 });
      
      if (interval === 'day') {
        current.setDate(current.getDate() + 1);
      } else if (interval === 'week') {
        current.setDate(current.getDate() + 7);
      } else if (interval === 'month') {
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    // Count messages by date
    let messageCount = 0;
    for await (const msg of streamAllMessages(start, end)) {
      messageCount++;
      if (messageCount > 200000) {
        return res.status(413).json({ 
          error: 'Too many messages to process. Please use background aggregation or reduce date range.' 
        });
      }
      
      const msgDate = new Date(msg.createdAt || msg.$createdAt || Date.now());
      const dateKey = msgDate.toISOString().split('T')[0];
      if (buckets.has(dateKey)) {
        buckets.get(dateKey).messages++;
      }
    }
    
    // Count sessions started by date
    for await (const session of streamAllSessions(start, end)) {
      const sessionDate = new Date(session.startTime || session.$createdAt || Date.now());
      const dateKey = sessionDate.toISOString().split('T')[0];
      if (buckets.has(dateKey)) {
        buckets.get(dateKey).sessionsStarted++;
      }
    }
    
    const result = Array.from(buckets.entries())
      .map(([date, data]) => ({ date, messages: data.messages, sessionsStarted: data.sessionsStarted }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    metricsCache.set(cacheKey, result);
    logExportAction(adminToken, ['metrics'], 'messages-over-time');
    
    res.json(result);
  } catch (err) {
    console.error('Error computing messages-over-time:', err);
    res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
  }
});

// GET /admin/metrics/agent-performance - Agent performance metrics
app.get('/admin/metrics/agent-performance', requireAdminAuth, async (req, res) => {
  const { from, to } = req.query;
  const authHeader = req.headers.authorization;
  const adminToken = authHeader ? authHeader.substring(7) : 'unknown';
  
  const cacheKey = getCacheKey('agent-performance', { from, to });
  const cached = metricsCache.get(cacheKey);
  if (cached) {
    console.log(`📊 [CACHE HIT] Agent performance`);
    return res.json(cached);
  }
  
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
    return res.status(503).json({ error: 'Appwrite not configured' });
  }
  
  const { start, end } = getDateRange(from, to);
  console.log(`📊 Computing agent performance: ${start.toISOString()} to ${end.toISOString()}`);
  
  try {
    const agentStats = new Map(); // agentId -> { sessionsHandled, messagesHandled, responseTimes, sessionStartTimes }
    const sessionAgentMap = new Map(); // sessionId -> agentId (for fallback mapping)
    
    const resolveAgentIdFromMessage = (msg) => {
      let agentId = null;
      let metadataRaw = msg?.metadata || null;
      
      if ((!metadataRaw || metadataRaw === '[REDACTED]') && msg?.encrypted_metadata) {
        const decrypted = decryptField(msg.encrypted_metadata);
        if (decrypted && decrypted !== '[ENCRYPTED]' && decrypted !== '[DECRYPTION_FAILED]') {
          metadataRaw = decrypted;
        }
      }
      
      if (metadataRaw) {
        try {
          const metadataObj = typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw;
          agentId = metadataObj?.agentId || metadataObj?.agent_id || metadataObj?.agent || null;
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      if (!agentId && msg?.sessionId) {
        agentId = sessionAgentMap.get(msg.sessionId) || null;
      }
      
      return agentId;
    };
    
    // Process sessions
    for await (const session of streamAllSessions(start, end)) {
      let assignedAgent = session.assignedAgent;
      if (!assignedAgent && session.userMeta) {
        try {
          const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta;
          assignedAgent = userMeta?.assignedAgent;
        } catch (e) {}
      }
      
      if (assignedAgent) {
        if (!agentStats.has(assignedAgent)) {
          agentStats.set(assignedAgent, {
            sessionsHandled: 0,
            messagesHandled: 0,
            responseTimes: [],
            sessionStartTimes: []
          });
        }
        const stats = agentStats.get(assignedAgent);
        stats.sessionsHandled++;
        const sessionStart = new Date(session.startTime || session.$createdAt || Date.now());
        stats.sessionStartTimes.push(sessionStart);
        sessionAgentMap.set(session.sessionId, assignedAgent);
      }
    }
    
    // Process messages for agents
    for await (const msg of streamAllMessages(start, end)) {
      if (msg.sender === 'agent') {
        let agentId = resolveAgentIdFromMessage(msg);
        
        if (agentId) {
          if (!agentStats.has(agentId)) {
            agentStats.set(agentId, {
              sessionsHandled: 0,
              messagesHandled: 0,
              responseTimes: [],
              sessionStartTimes: []
            });
          }
          agentStats.get(agentId).messagesHandled++;
        }
      }
    }
    
    // Compute response times (user message -> agent message in same session)
    const sessionMessages = new Map();
    for await (const msg of streamAllMessages(start, end)) {
      if (!sessionMessages.has(msg.sessionId)) {
        sessionMessages.set(msg.sessionId, []);
      }
      sessionMessages.get(msg.sessionId).push({
        sender: msg.sender,
        createdAt: new Date(msg.createdAt || msg.$createdAt || Date.now()),
        sessionId: msg.sessionId,
        metadata: msg.metadata,
        agentId: msg.sender === 'agent' ? resolveAgentIdFromMessage(msg) : null
      });
    }
    
    for (const [sessionId, messages] of sessionMessages.entries()) {
      const sorted = messages.sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].sender === 'user') {
          // Find next agent message
          for (let j = i + 1; j < sorted.length; j++) {
            if (sorted[j].sender === 'agent') {
              let agentId = sorted[j].agentId || resolveAgentIdFromMessage(sorted[j]);
              if (agentId && agentStats.has(agentId)) {
                const responseTime = sorted[j].createdAt - sorted[i].createdAt;
                if (responseTime > 0 && responseTime < 300000) {
                  agentStats.get(agentId).responseTimes.push(responseTime);
                }
              }
              break;
            }
          }
        }
      }
    }
    
    // Compute resolution times (session start -> last agent message)
    for (const [agentId, stats] of agentStats.entries()) {
      // Get sessions for this agent
      for await (const session of streamAllSessions(start, end)) {
        let assignedAgent = session.assignedAgent;
        if (!assignedAgent && session.userMeta) {
          try {
            const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta;
            assignedAgent = userMeta?.assignedAgent;
          } catch (e) {}
        }
        
        if (assignedAgent === agentId) {
          const sessionStart = new Date(session.startTime || session.$createdAt || Date.now());
          const sessionMsgs = sessionMessages.get(session.sessionId) || [];
          const agentMsgs = sessionMsgs.filter(m => m.sender === 'agent' && (m.agentId || resolveAgentIdFromMessage(m)) === agentId);
          
          if (agentMsgs.length > 0) {
            const lastAgentMsg = agentMsgs[agentMsgs.length - 1];
            const resolutionTime = lastAgentMsg.createdAt - sessionStart;
            if (resolutionTime > 0) {
              stats.sessionStartTimes.push(resolutionTime);
            }
          }
        }
      }
    }
    
    const result = Array.from(agentStats.entries()).map(([agentId, stats]) => {
      const avgResponseTimeMs = stats.responseTimes.length > 0
        ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
        : 0;
      const avgResolutionTimeMs = stats.sessionStartTimes.length > 0
        ? Math.round(stats.sessionStartTimes.reduce((a, b) => a + b, 0) / stats.sessionStartTimes.length)
        : 0;
      
      return {
        agentId,
        sessionsHandled: stats.sessionsHandled,
        avgResponseTimeMs,
        avgResolutionTimeMs,
        messagesHandled: stats.messagesHandled
      };
    }).sort((a, b) => b.sessionsHandled - a.sessionsHandled);
    
    metricsCache.set(cacheKey, result);
    logExportAction(adminToken, ['metrics'], 'agent-performance');
    
    res.json(result);
  } catch (err) {
    console.error('Error computing agent performance:', err);
    res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
  }
});

// GET /admin/metrics/confidence-histogram - Confidence score distribution
app.get('/admin/metrics/confidence-histogram', requireAdminAuth, async (req, res) => {
  const { from, to, bins = 10 } = req.query;
  const authHeader = req.headers.authorization;
  const adminToken = authHeader ? authHeader.substring(7) : 'unknown';
  
  const cacheKey = getCacheKey('confidence-histogram', { from, to, bins });
  const cached = metricsCache.get(cacheKey);
  if (cached) {
    console.log(`📊 [CACHE HIT] Confidence histogram`);
    return res.json(cached);
  }
  
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
    return res.status(503).json({ error: 'Appwrite not configured' });
  }
  
  const { start, end } = getDateRange(from, to);
  const numBins = parseInt(bins) || 10;
  console.log(`📊 Computing confidence histogram: ${start.toISOString()} to ${end.toISOString()}, bins=${numBins}`);
  
  try {
    const confidences = [];
    let messageCount = 0;
    
    for await (const msg of streamAllMessages(start, end)) {
      messageCount++;
      if (messageCount > 200000) {
        return res.status(413).json({ 
          error: 'Too many messages to process. Please use background aggregation or reduce date range.' 
        });
      }
      
      if (msg.sender === 'bot' && msg.confidence !== null && msg.confidence !== undefined) {
        confidences.push(parseFloat(msg.confidence));
      }
    }
    
    if (confidences.length === 0) {
      return res.json([]);
    }
    
    const min = Math.min(...confidences);
    const max = Math.max(...confidences);
    const binWidth = (max - min) / numBins;
    
    const histogram = Array(numBins).fill(0).map((_, i) => {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const count = confidences.filter(c => c >= binStart && (i === numBins - 1 ? c <= binEnd : c < binEnd)).length;
      return {
        bin: `${(binStart * 100).toFixed(0)}-${(binEnd * 100).toFixed(0)}%`,
        count,
        start: binStart,
        end: binEnd
      };
    });
    
    metricsCache.set(cacheKey, histogram);
    logExportAction(adminToken, ['metrics'], 'confidence-histogram');
    
    res.json(histogram);
  } catch (err) {
    console.error('Error computing confidence histogram:', err);
    res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
  }
});

// GET /admin/metrics/response-times - Response time percentiles
app.get('/admin/metrics/response-times', requireAdminAuth, async (req, res) => {
  const { from, to, percentiles = '50,90,99' } = req.query;
  const authHeader = req.headers.authorization;
  const adminToken = authHeader ? authHeader.substring(7) : 'unknown';
  
  const cacheKey = getCacheKey('response-times', { from, to, percentiles });
  const cached = metricsCache.get(cacheKey);
  if (cached) {
    console.log(`📊 [CACHE HIT] Response times`);
    return res.json(cached);
  }
  
  if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
    return res.status(503).json({ error: 'Appwrite not configured' });
  }
  
  const { start, end } = getDateRange(from, to);
  const percentileList = percentiles.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
  console.log(`📊 Computing response times: ${start.toISOString()} to ${end.toISOString()}, percentiles=${percentiles}`);
  
  try {
    const responseTimes = [];
    const sessionMessages = new Map();
    
    // Group messages by session
    for await (const msg of streamAllMessages(start, end)) {
      if (!sessionMessages.has(msg.sessionId)) {
        sessionMessages.set(msg.sessionId, []);
      }
      sessionMessages.get(msg.sessionId).push({
        sender: msg.sender,
        createdAt: new Date(msg.createdAt || msg.$createdAt || Date.now())
      });
    }
    
    // Compute response times (user -> bot)
    for (const [sessionId, messages] of sessionMessages.entries()) {
      const sorted = messages.sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].sender === 'user' && sorted[i + 1].sender === 'bot') {
          const responseTime = sorted[i + 1].createdAt - sorted[i].createdAt;
          if (responseTime > 0 && responseTime < 300000) { // Max 5 minutes
            responseTimes.push(responseTime);
          }
        }
      }
    }
    
    if (responseTimes.length === 0) {
      return res.json({ percentiles: {}, count: 0 });
    }
    
    responseTimes.sort((a, b) => a - b);
    
    const result = {
      percentiles: {},
      count: responseTimes.length,
      min: responseTimes[0],
      max: responseTimes[responseTimes.length - 1],
      avg: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    };
    
    for (const p of percentileList) {
      const index = Math.ceil((p / 100) * responseTimes.length) - 1;
      result.percentiles[`p${p}`] = responseTimes[Math.max(0, index)];
    }
    
    metricsCache.set(cacheKey, result);
    logExportAction(adminToken, ['metrics'], 'response-times');
    
    res.json(result);
  } catch (err) {
    console.error('Error computing response times:', err);
    res.status(500).json({ error: err?.message || 'Failed to compute metrics' });
  }
});

// POST /admin/metrics/aggregate-request - Request background aggregation (stub)
app.post('/admin/metrics/aggregate-request', requireAdminAuth, async (req, res) => {
  const { from, to, metrics } = req.body;
  const authHeader = req.headers.authorization;
  const adminToken = authHeader ? authHeader.substring(7) : 'unknown';
  
  console.log(`📊 [AGGREGATE REQUEST] Admin: ${adminToken}, From: ${from}, To: ${to}, Metrics: ${metrics?.join(', ') || 'all'}`);
  // TODO: Implement background job queue (Bull/BullMQ, Celery, etc.)
  // TODO: Store aggregation request in Appwrite or job queue
  // TODO: Process in background worker and store results in precomputed analytics collection
  
  res.status(202).json({ 
    message: 'Aggregation request received. Results will be available via background job.',
    jobId: `job_${Date.now()}` // Placeholder
  });
});

// ============================================================================
// END OF ANALYTICS & METRICS ENDPOINTS
// All metrics endpoints are defined above (starting around line 1531)
// ============================================================================

// ============================================================================
// RBAC USER MANAGEMENT ENDPOINTS
// ============================================================================

// GET /me - Get current user profile and roles
app.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // If collection doesn't exist, return dev user info
    const collectionExists = await checkUsersCollectionExists();
    if (!collectionExists) {
      return res.json({
        userId: req.user.userId,
        email: req.user.email || 'dev@admin.local',
        name: 'Dev Admin',
        roles: req.user.roles || ['super_admin']
      });
    }
    
    const user = await getUserById(userId);
    if (!user) {
      // Return dev user info if not found in DB
      return res.json({
        userId: req.user.userId,
        email: req.user.email || 'dev@admin.local',
        name: 'Dev Admin',
        roles: req.user.roles || ['super_admin']
      });
    }
    res.json({
      userId: user.userId,
      email: user.email,
      name: user.name,
      roles: Array.isArray(user.roles) ? user.roles : []
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    // Fallback to req.user if error
    res.json({
      userId: req.user.userId,
      email: req.user.email || 'dev@admin.local',
      name: 'Dev Admin',
      roles: req.user.roles || ['super_admin']
    });
  }
});

// GET /admin/users - List all users (super_admin only)
app.get('/admin/users', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    // Validate pagination params
    try {
      validatePaginationParams(req);
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }
    
    // Parse pagination params
    const { limit, offset } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });
    
    if (!awDatabases || !APPWRITE_DATABASE_ID) {
      return res.json({ items: [], total: 0, limit, offset, hasMore: false, error: 'Appwrite not configured' });
    }
    
    // NOTE: For production, add index on email for better performance
    // Index configuration: Attribute: email, Type: key
    const queries = [];
    if (Query) {
      queries.push(Query.orderDesc('$createdAt')); // Newest first
    }
    
    console.log(`📋 Fetching users: limit=${limit}, offset=${offset}`);
    
    const result = await awDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_USERS_COLLECTION_ID,
      queries.length > 0 ? queries : undefined,
      limit,
      offset
    );
    
    const users = result.documents.map(doc => ({
      userId: doc.userId,
      email: doc.email,
      name: doc.name,
      roles: Array.isArray(doc.roles) ? doc.roles : [],
      createdAt: doc.createdAt || doc.$createdAt,
      updatedAt: doc.updatedAt || doc.$updatedAt
    }));
    
    const paginationMeta = calculatePaginationMeta(result.total, limit, offset);
    
    console.log(`✅ Found ${result.total} total user(s), ${users.length} in this page`);
    
    res.json({
      items: users,
      users, // Backward compatibility
      total: result.total,
      limit,
      offset,
      hasMore: paginationMeta.hasMore,
      currentPage: paginationMeta.currentPage,
      totalPages: paginationMeta.totalPages
    });
  } catch (err) {
    console.error('Error listing users:', err);
    res.status(500).json({ error: err?.message || 'Failed to list users' });
  }
});

// POST /admin/users - Create user (super_admin only)
app.post('/admin/users', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const { email, name, roles } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    // Check if user already exists (with retry for index sync)
    let existing = null;
    try {
      existing = await getUserByEmail(email);
    } catch (err) {
      // If query fails, try listing all users as fallback
      try {
        const allUsers = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          [],
          1000
        );
        existing = allUsers.documents.find(doc => doc.email === email);
      } catch (listErr) {
        // Ignore
      }
    }
    
    if (existing) {
      return res.status(409).json({ 
        error: 'User with this email already exists',
        user: {
          userId: existing.userId,
          email: existing.email,
          name: existing.name,
          roles: Array.isArray(existing.roles) ? existing.roles : []
        }
      });
    }
    
    // Generate userId from email or use provided
    // Make userId more unique to avoid conflicts
    const userId = req.body.userId || email.split('@')[0] + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    
    const user = await ensureUserRecord(userId, { email, name: name || email });
    const effectiveUserId = user?.userId || userId;
    if (!user) {
      // Check if collection exists
      const collectionExists = await checkUsersCollectionExists();
      if (!collectionExists) {
        return res.status(503).json({ error: 'Users collection not found. Please run migration: node migrate_create_users_collection.js' });
      }
      
      // ensureUserRecord returned null - this means user creation failed or user exists but can't be found
      // Try one more comprehensive search with longer wait
      console.log(`⚠️  ensureUserRecord returned null, doing final comprehensive search...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for index sync
      
      // Try listing ALL users and finding by email
      try {
        let allUsers = [];
        let offset = 0;
        const pageSize = 100;
        let hasMore = true;
        
        while (hasMore && allUsers.length < 1000) {
          const page = await awDatabases.listDocuments(
            APPWRITE_DATABASE_ID,
            APPWRITE_USERS_COLLECTION_ID,
            [],
            pageSize,
            offset
          );
          allUsers = allUsers.concat(page.documents);
          hasMore = page.documents.length === pageSize;
          offset += pageSize;
        }
        
        const foundUser = allUsers.find(doc => doc.email === email || doc.userId === userId);
        if (foundUser) {
          console.log(`✅ Found user via comprehensive search after ensureUserRecord returned null`);
          const finalUser = foundUser;
          // Set roles if provided
          if (roles && Array.isArray(roles)) {
            await setUserRoles(finalUser.userId, roles);
            const updated = await getUserById(finalUser.userId);
            if (updated) {
              return res.json({
                userId: updated.userId,
                email: updated.email,
                name: updated.name,
                roles: Array.isArray(updated.roles) ? updated.roles : []
              });
            }
          }
          return res.json({
            userId: finalUser.userId,
            email: finalUser.email,
            name: finalUser.name,
            roles: Array.isArray(finalUser.roles) ? finalUser.roles : []
          });
        }
      } catch (searchErr) {
        console.error(`❌ Comprehensive search failed:`, searchErr.message);
      }
      
      // If still not found after all retries, try one final creation attempt
      // This handles the case where 409 was a document ID conflict and the user doesn't actually exist
      console.log(`⚠️  User not found after comprehensive search. Attempting final creation...`);
      try {
        const { ID } = require('node-appwrite');
        const finalDocId = ID.unique();
        const timestamp = new Date().toISOString();
        const finalUser = await awDatabases.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          finalDocId,
          {
            userId,
            email,
            name: name || email,
            roles: [],
            createdAt: timestamp,
            updatedAt: timestamp
          }
        );
        console.log(`✅ Successfully created user on final attempt with document ID: ${finalDocId}`);
        
        // Set roles if provided
        if (roles && Array.isArray(roles)) {
        await setUserRoles(effectiveUserId, roles);
          // Wait a bit for index sync
          await new Promise(resolve => setTimeout(resolve, 500));
        const updated = await getUserById(effectiveUserId);
          if (updated) {
            return res.json({
              userId: updated.userId,
              email: updated.email,
              name: updated.name,
              roles: Array.isArray(updated.roles) ? updated.roles : []
            });
          }
        }
        
        return res.json({
          userId: finalUser.userId,
          email: finalUser.email,
          name: finalUser.name,
          roles: Array.isArray(finalUser.roles) ? finalUser.roles : []
        });
      } catch (finalErr) {
        // If final attempt also fails, return error
        console.error(`❌ Final user creation attempt failed:`, finalErr.message);
        if (finalErr.code === 409) {
          return res.status(409).json({ 
            error: 'User with this email or userId already exists',
            hint: 'The user exists but cannot be queried due to index sync delays. Wait a few seconds and try again, or check Appwrite Console manually.'
          });
        }
        return res.status(500).json({ 
          error: 'Failed to create user after multiple attempts',
          hint: 'Check server logs for details. This may indicate a database configuration issue.'
        });
      }
    }
    
    // Set roles if provided
    if (roles && Array.isArray(roles)) {
      const rolesSet = await setUserRoles(effectiveUserId, roles);
      if (rolesSet) {
        const updatedUser = await getUserById(effectiveUserId);
        if (updatedUser) {
          return res.json({
            userId: updatedUser.userId,
            email: updatedUser.email,
            name: updatedUser.name,
            roles: Array.isArray(updatedUser.roles) ? updatedUser.roles : []
          });
        }
      }
      // Fallback: return user without updated roles
      return res.json({
        userId: user.userId || effectiveUserId,
        email: user.email || email,
        name: user.name || name || email,
        roles: roles
      });
    } else {
      res.json({
        userId: user.userId || effectiveUserId,
        email: user.email || email,
        name: user.name || name || email,
        roles: Array.isArray(user.roles) ? user.roles : []
      });
    }
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: err?.message || 'Failed to create user' });
  }
});

// PUT /admin/users/:userId/roles - Update user roles (super_admin only)
app.put('/admin/users/:userId/roles', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { roles } = req.body;
    
    if (!roles || !Array.isArray(roles)) {
      return res.status(400).json({ error: 'roles array is required' });
    }
    
    // Validate roles
    const validRoles = ['super_admin', 'admin', 'agent', 'viewer'];
    for (const role of roles) {
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role: ${role}` });
      }
    }
    
    const changedBy = req.user.userId;
    console.log(`🔧 Updating roles for user ${userId} by ${changedBy}`);
    
    // Try to find user with retries (index sync delays)
    let user = await getUserById(userId);
    if (!user) {
      // Retry with delays
      const maxRetries = 3;
      const delays = [300, 500, 1000];
      for (let attempt = 0; attempt < maxRetries && !user; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
        }
        user = await getUserById(userId);
        if (user) break;
      }
    }
    
    // If still not found, try listing all users
    if (!user) {
      try {
        const allUsers = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_USERS_COLLECTION_ID,
          [],
          1000
        );
        user = allUsers.documents.find(doc => doc.userId === userId);
      } catch (listErr) {
        // Ignore
      }
    }
    
    if (!user) {
      console.error(`❌ User ${userId} not found for role update`);
      return res.status(404).json({ error: 'User not found. User may have been deleted or indexes may not be synced yet.' });
    }
    
    const oldRoles = Array.isArray(user.roles) ? [...user.roles] : [];
    const success = await setUserRoles(userId, roles);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to update roles' });
    }
    
    // Log audit
    await logRoleChange(userId, changedBy, oldRoles, roles);
    
    res.json({
      userId,
      roles,
      message: 'Roles updated successfully'
    });
  } catch (err) {
    console.error('Error updating user roles:', err);
    res.status(500).json({ error: err?.message || 'Failed to update roles' });
  }
});

// DELETE /admin/users/:userId - Delete user (super_admin only)
app.delete('/admin/users/:userId', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const { userId } = req.params;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await awDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_USERS_COLLECTION_ID,
      user.$id
    );
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: err?.message || 'Failed to delete user' });
  }
});

// ============================================================================
// END OF RBAC USER MANAGEMENT ENDPOINTS
// ============================================================================

// ============================================================================
// ACCURACY LOGGING ENDPOINTS
// ============================================================================

// In-memory cache for accuracy stats (TTL 60s)
const accuracyStatsCache = new LRUCache({
  max: 100,
  ttl: 60000 // 60 seconds
});

// GET /admin/accuracy - List accuracy records with filtering and pagination
app.get('/admin/accuracy', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    // Validate pagination params
    try {
      validatePaginationParams(req);
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }
    
    // Parse pagination params
    const { limit, offset } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });
    
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
      return res.json({ items: [], total: 0, limit, offset, hasMore: false, error: 'Appwrite not configured' });
    }
    
    const { sessionId, from, to, mark, sortBy = 'createdAt', order = 'desc' } = req.query;
    const queries = [];
    
    if (sessionId) {
      queries.push(Query.equal('sessionId', sessionId));
    }
    
    if (from || to) {
      const fromDate = from ? new Date(from) : new Date(0);
      const toDate = to ? new Date(to) : new Date();
      queries.push(Query.between('createdAt', fromDate.toISOString(), toDate.toISOString()));
    }
    
    if (mark) {
      queries.push(Query.equal('humanMark', mark));
    }
    
    // Add ordering
    // NOTE: For production, add indexes on createdAt, sessionId, humanMark for better performance
    // Index configuration:
    //   - Attribute: createdAt, Type: key, Order: desc
    //   - Attribute: sessionId, Type: key
    //   - Attribute: humanMark, Type: key
    if (sortBy === 'createdAt') {
      if (order === 'desc') {
        queries.push(Query.orderDesc('createdAt'));
      } else {
        queries.push(Query.orderAsc('createdAt'));
      }
    }
    
    console.log(`📋 Fetching accuracy records: limit=${limit}, offset=${offset}, filters: sessionId=${sessionId || 'none'}, from=${from || 'none'}, to=${to || 'none'}, mark=${mark || 'none'}`);
    
    const result = await awDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_AI_ACCURACY_COLLECTION_ID,
      queries,
      limit,
      offset
    );
    
    const paginationMeta = calculatePaginationMeta(result.total, limit, offset);
    
    console.log(`✅ Found ${result.total} total accuracy record(s), ${result.documents.length} in this page`);
    
    res.json({
      items: result.documents,
      records: result.documents, // Backward compatibility
      total: result.total,
      limit,
      offset,
      hasMore: paginationMeta.hasMore,
      currentPage: paginationMeta.currentPage,
      totalPages: paginationMeta.totalPages
    });
  } catch (err) {
    console.error('Error listing accuracy records:', err);
    res.status(500).json({ error: err?.message || 'Failed to list accuracy records' });
  }
});

// GET /admin/accuracy/stats - Get aggregated accuracy statistics
app.get('/admin/accuracy/stats', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const { from, to } = req.query;
    const cacheKey = `stats_${from || 'all'}_${to || 'all'}`;
    
    // Check cache
    const cached = accuracyStatsCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
    const toDate = to ? new Date(to) : new Date();
    
    const queries = [Query.between('createdAt', fromDate.toISOString(), toDate.toISOString())];
    
    // Stream through all records with pagination
    let totalScanned = 0;
    let totalResponses = 0;
    let totalConfidence = 0;
    let totalLatency = 0;
    let helpfulCount = 0;
    let unhelpfulCount = 0;
    let flaggedCount = 0;
    let hasMore = true;
    let offset = 0;
    const pageSize = 100;
    
    while (hasMore && totalScanned < ACCURACY_MAX_SCAN_ROWS) {
      const pageQueries = [...queries, Query.limit(pageSize), Query.offset(offset)];
      const result = await awDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_AI_ACCURACY_COLLECTION_ID,
        pageQueries
      );
      
      for (const doc of result.documents) {
        totalScanned++;
        totalResponses++;
        
        if (doc.confidence !== null && doc.confidence !== undefined) {
          totalConfidence += doc.confidence;
        }
        
        if (doc.latencyMs !== null && doc.latencyMs !== undefined) {
          totalLatency += doc.latencyMs;
        }
        
        if (doc.humanMark === 'up') helpfulCount++;
        else if (doc.humanMark === 'down') unhelpfulCount++;
        else if (doc.humanMark === 'flag') flaggedCount++;
      }
      
      offset += pageSize;
      hasMore = result.documents.length === pageSize;
    }
    
    if (totalScanned >= ACCURACY_MAX_SCAN_ROWS) {
      return res.status(413).json({
        error: 'Too many records to scan',
        message: 'Please use a smaller date range or implement background aggregation',
        scanned: totalScanned,
        maxAllowed: ACCURACY_MAX_SCAN_ROWS
      });
    }
    
    const stats = {
      totalResponses,
      avgConfidence: totalResponses > 0 ? totalConfidence / totalResponses : 0,
      avgLatencyMs: totalResponses > 0 ? Math.round(totalLatency / totalResponses) : 0,
      helpfulRate: totalResponses > 0 ? (helpfulCount / totalResponses) * 100 : 0,
      unhelpfulRate: totalResponses > 0 ? (unhelpfulCount / totalResponses) * 100 : 0,
      flaggedCount,
      startDate: fromDate.toISOString(),
      endDate: toDate.toISOString()
    };
    
    // Cache result
    accuracyStatsCache.set(cacheKey, stats);
    
    res.json(stats);
  } catch (err) {
    console.error('Error computing accuracy stats:', err);
    res.status(500).json({ error: err?.message || 'Failed to compute stats' });
  }
});

// GET /admin/accuracy/:accuracyId - Get single accuracy record
app.get('/admin/accuracy/:accuracyId', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const { accuracyId } = req.params;
    const doc = await awDatabases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_AI_ACCURACY_COLLECTION_ID,
      accuracyId
    );
    
    res.json(doc);
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ error: 'Accuracy record not found' });
    }
    console.error('Error fetching accuracy record:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch accuracy record' });
  }
});

// POST /admin/accuracy/:accuracyId/feedback - Add feedback to accuracy record
app.post('/admin/accuracy/:accuracyId/feedback', requireAuth, async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const { accuracyId } = req.params;
    const { mark, note } = req.body;
    
    console.log(`📝 Adding feedback to accuracy record ${accuracyId}:`, { mark, note });
    
    if (!mark || !['up', 'down', 'flag'].includes(mark)) {
      return res.status(400).json({ error: 'mark must be "up", "down", or "flag"' });
    }
    
    // Get current record
    const current = await awDatabases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_AI_ACCURACY_COLLECTION_ID,
      accuracyId
    );
    
    // Update record - handle missing evaluation attribute gracefully
    const updateData = {
      humanMark: mark
    };
    
    // Include evaluation if note is provided (even if empty string - convert to null to clear)
    if (note !== undefined) {
      updateData.evaluation = note === '' ? null : note;
    }
    
    console.log(`📝 Update data:`, updateData);
    
    try {
      const result = await awDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_AI_ACCURACY_COLLECTION_ID,
        accuracyId,
        updateData
      );
      console.log(`✅ Successfully updated accuracy feedback ${accuracyId}:`, result);
    } catch (updateErr) {
      // If evaluation attribute doesn't exist, retry without it
      if (updateErr.message?.includes('evaluation') || updateErr.message?.includes('Unknown attribute')) {
        console.warn(`⚠️  Collection doesn't have 'evaluation' attribute - retrying without it`);
        delete updateData.evaluation;
        const result = await awDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_AI_ACCURACY_COLLECTION_ID,
          accuracyId,
          updateData
        );
        console.log(`✅ Successfully updated accuracy feedback (without evaluation) ${accuracyId}:`, result);
      } else {
        console.error(`❌ Error updating accuracy feedback:`, updateErr);
        throw updateErr;
      }
    }
    
    // Log audit
    const adminId = req.user?.userId || 'anonymous';
    await logAccuracyAudit(accuracyId, adminId, 'feedback', note);
    
    // Clear cache
    accuracyStatsCache.clear();
    
    res.json({ success: true, accuracyId, mark });
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ error: 'Accuracy record not found' });
    }
    console.error('Error updating accuracy feedback:', err);
    res.status(500).json({ error: err?.message || 'Failed to update feedback' });
  }
});

// POST /session/:sessionId/feedback - Anonymous session feedback (links to last AI message)
app.post('/session/:sessionId/feedback', async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const { sessionId } = req.params;
    const { mark } = req.body;
    
    if (!mark || !['up', 'down', 'flag'].includes(mark)) {
      return res.status(400).json({ error: 'mark must be "up", "down", or "flag"' });
    }
    
    // Find last AI accuracy record for this session
    const result = await awDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_AI_ACCURACY_COLLECTION_ID,
      [
        Query.equal('sessionId', sessionId),
        Query.orderDesc('createdAt'),
        Query.limit(1)
      ]
    );
    
    if (result.documents.length === 0) {
      return res.status(404).json({ error: 'No AI accuracy records found for this session' });
    }
    
    const accuracyId = result.documents[0].$id;
    
    // Update record
    await awDatabases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_AI_ACCURACY_COLLECTION_ID,
      accuracyId,
      { humanMark: mark }
    );
    
    // Log audit
    await logAccuracyAudit(accuracyId, 'anonymous', 'feedback', `Session feedback: ${mark}`);
    
    // Clear cache
    accuracyStatsCache.clear();
    
    res.json({ success: true, accuracyId, mark });
  } catch (err) {
    console.error('Error updating session feedback:', err);
    res.status(500).json({ error: err?.message || 'Failed to update feedback' });
  }
});

// POST /admin/accuracy/:accuracyId/evaluate - Admin evaluation
app.post('/admin/accuracy/:accuracyId/evaluate', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const { accuracyId } = req.params;
    const { evaluation, humanMark } = req.body;
    
    console.log(`📝 Evaluating accuracy record ${accuracyId}:`, { evaluation, humanMark });
    
    const updateData = {};
    if (humanMark !== undefined && ['up', 'down', 'flag', null].includes(humanMark)) {
      updateData.humanMark = humanMark;
    }
    // Include evaluation if it's provided (even if empty string - to clear it)
    if (evaluation !== undefined) {
      // Convert empty string to null to clear evaluation
      updateData.evaluation = evaluation === '' ? null : evaluation;
    }
    
    console.log(`📝 Update data:`, updateData);
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No data to update. Provide evaluation or humanMark.' });
    }
    
    try {
      const result = await awDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_AI_ACCURACY_COLLECTION_ID,
        accuracyId,
        updateData
      );
      console.log(`✅ Successfully updated accuracy record ${accuracyId}:`, result);
    } catch (updateErr) {
      // If evaluation attribute doesn't exist, retry without it
      if (updateErr.message?.includes('evaluation') || updateErr.message?.includes('Unknown attribute')) {
        console.warn(`⚠️  Collection doesn't have 'evaluation' attribute - retrying without it`);
        delete updateData.evaluation;
        // Retry with only humanMark if it was provided
        if (Object.keys(updateData).length > 0) {
          const result = await awDatabases.updateDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_AI_ACCURACY_COLLECTION_ID,
            accuracyId,
            updateData
          );
          console.log(`✅ Successfully updated accuracy record (without evaluation) ${accuracyId}:`, result);
        } else {
          throw new Error('Cannot update: evaluation attribute missing and no other fields to update');
        }
      } else {
        console.error(`❌ Error updating accuracy record:`, updateErr);
        throw updateErr;
      }
    }
    
    // Log audit
    const adminId = req.user?.userId || 'anonymous';
    await logAccuracyAudit(accuracyId, adminId, 'evaluate', evaluation);
    
    // Clear cache
    accuracyStatsCache.clear();
    
    res.json({ success: true, accuracyId });
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ error: 'Accuracy record not found' });
    }
    console.error('Error evaluating accuracy:', err);
    res.status(500).json({ error: err?.message || 'Failed to evaluate' });
  }
});

// GET /admin/accuracy/export - Export accuracy logs
app.get('/admin/accuracy/export', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const { format = 'json', from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    
    const queries = [Query.between('createdAt', fromDate.toISOString(), toDate.toISOString()), Query.orderAsc('createdAt')];
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="accuracy_export_${Date.now()}.csv"`);
      
      // Write CSV header
      res.write('createdAt,sessionId,aiText,confidence,latencyMs,tokens,responseType,humanMark,evaluation\n');
      
      // Stream results
      let offset = 0;
      const pageSize = 100;
      let hasMore = true;
      
      while (hasMore) {
        const pageQueries = [...queries, Query.limit(pageSize), Query.offset(offset)];
        const result = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_AI_ACCURACY_COLLECTION_ID,
          pageQueries
        );
        
        for (const doc of result.documents) {
          const row = [
            doc.createdAt || '',
            doc.sessionId || '',
            `"${(doc.aiText || '').replace(/"/g, '""')}"`,
            doc.confidence || '',
            doc.latencyMs || '',
            doc.tokens || '',
            doc.responseType || '',
            doc.humanMark || '',
            `"${(doc.evaluation || '').replace(/"/g, '""')}"`
          ].join(',');
          res.write(row + '\n');
        }
        
        offset += pageSize;
        hasMore = result.documents.length === pageSize;
      }
      
      res.end();
    } else {
      // JSON export
      const allDocs = [];
      let offset = 0;
      const pageSize = 100;
      let hasMore = true;
      
      while (hasMore) {
        const pageQueries = [...queries, Query.limit(pageSize), Query.offset(offset)];
        const result = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_AI_ACCURACY_COLLECTION_ID,
          pageQueries
        );
        
        allDocs.push(...result.documents);
        offset += pageSize;
        hasMore = result.documents.length === pageSize;
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="accuracy_export_${Date.now()}.json"`);
      res.json(allDocs);
    }
  } catch (err) {
    console.error('Error exporting accuracy:', err);
    res.status(500).json({ error: err?.message || 'Failed to export' });
  }
});

// POST /admin/accuracy/cleanup - Cleanup old records (super_admin only)
// TODO: Schedule as cron/Appwrite Function in production
app.post('/admin/accuracy/cleanup', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_AI_ACCURACY_COLLECTION_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const cutoffDate = new Date(Date.now() - ACCURACY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    
    // Find old records
    const result = await awDatabases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_AI_ACCURACY_COLLECTION_ID,
      [
        Query.lessThan('createdAt', cutoffDate.toISOString()),
        Query.limit(1000) // Process in batches
      ]
    );
    
    let deleted = 0;
    for (const doc of result.documents) {
      try {
        await awDatabases.deleteDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_AI_ACCURACY_COLLECTION_ID,
          doc.$id
        );
        deleted++;
      } catch (delErr) {
        console.warn(`Failed to delete ${doc.$id}:`, delErr.message);
      }
    }
    
    res.json({
      success: true,
      deleted,
      cutoffDate: cutoffDate.toISOString(),
      message: `Deleted ${deleted} records older than ${ACCURACY_RETENTION_DAYS} days. Run again to process more.`
    });
  } catch (err) {
    console.error('Error cleaning up accuracy records:', err);
    res.status(500).json({ error: err?.message || 'Failed to cleanup' });
  }
});

// ============================================================================
// END OF ACCURACY LOGGING ENDPOINTS
// ============================================================================

// ============================================================================
// ENCRYPTION MANAGEMENT ENDPOINTS (super_admin only)
// ============================================================================

const APPWRITE_ENCRYPTION_AUDIT_COLLECTION_ID = 'encryption_audit';

// Helper: Log encryption action to audit collection
async function logEncryptionAction(action, adminId, stats = {}) {
  if (!awDatabases || !APPWRITE_DATABASE_ID) {
    return;
  }
  
  try {
    await awDatabases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_ENCRYPTION_AUDIT_COLLECTION_ID,
      'unique()',
      {
        action,
        adminId: adminId || 'system',
        stats: typeof stats === 'object' ? JSON.stringify(stats) : stats,
        ts: new Date().toISOString()
      }
    );
  } catch (err) {
    // Ignore errors (collection might not exist)
    console.warn('Failed to log encryption action:', err.message);
  }
}

// GET /admin/encryption/status - Get encryption status
app.get('/admin/encryption/status', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    const status = {
      encryptionEnabled: ENCRYPTION_ENABLED,
      masterKeyPresent: !!MASTER_KEY_BASE64,
      redactPII: REDACT_PII,
      collections: {}
    };
    
    if (!awDatabases || !APPWRITE_DATABASE_ID) {
      return res.json({ ...status, message: 'Appwrite not configured' });
    }
    
    // Sample scan to count encrypted vs plaintext docs
    const collections = [
      { id: APPWRITE_MESSAGES_COLLECTION_ID, name: 'messages', field: 'encrypted' },
      { id: APPWRITE_SESSIONS_COLLECTION_ID, name: 'sessions', field: 'encrypted_userMeta' },
      { id: APPWRITE_USERS_COLLECTION_ID, name: 'users', field: 'encrypted_notes' },
      { id: APPWRITE_AI_ACCURACY_COLLECTION_ID, name: 'ai_accuracy', field: 'encrypted_aiText' }
    ];
    
    for (const coll of collections) {
      if (!coll.id) continue;
      
      try {
        const sample = await awDatabases.listDocuments(
          APPWRITE_DATABASE_ID,
          coll.id,
          [],
          100
        );
        
        let encryptedCount = 0;
        let plaintextCount = 0;
        
        sample.documents.forEach(doc => {
          if (doc[coll.field] && encryption && encryption.isEncrypted(doc[coll.field])) {
            encryptedCount++;
          } else if (doc[coll.field] || doc.text || doc.userMeta || doc.sensitiveNotes || doc.aiText) {
            plaintextCount++;
          }
        });
        
        status.collections[coll.name] = {
          encrypted: encryptedCount,
          plaintext: plaintextCount,
          total: sample.total
        };
      } catch (err) {
        status.collections[coll.name] = { error: err.message };
      }
    }
    
    await logEncryptionAction('status_check', req.user?.userId || 'unknown', status);
    res.json(status);
  } catch (err) {
    console.error('Error getting encryption status:', err);
    res.status(500).json({ error: err?.message || 'Failed to get status' });
  }
});

// POST /admin/encryption/reencrypt - Trigger key rotation (synchronous for small sets)
app.post('/admin/encryption/reencrypt', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    const { newMasterKeyBase64 } = req.body;
    
    if (!newMasterKeyBase64) {
      return res.status(400).json({ error: 'newMasterKeyBase64 required in request body' });
    }
    
    // Validate key length
    const keyBuffer = Buffer.from(newMasterKeyBase64, 'base64');
    if (keyBuffer.length !== 32) {
      return res.status(400).json({ error: 'newMasterKeyBase64 must decode to 32 bytes' });
    }
    
    // For large datasets, return 202 and suggest using migration script
    res.status(202).json({
      message: 'Key rotation should be performed using migration script: node migrations/rotate_master_key.js',
      jobId: `rotation_${Date.now()}`,
      instructions: [
        '1. Set NEW_MASTER_KEY_BASE64 environment variable',
        '2. Run: node migrations/rotate_master_key.js --preview (to preview)',
        '3. Run: node migrations/rotate_master_key.js (to execute)',
        '4. Update MASTER_KEY_BASE64 in environment after rotation'
      ]
    });
    
    await logEncryptionAction('reencrypt_requested', req.user?.userId || 'unknown', { newKeySet: true });
  } catch (err) {
    console.error('Error requesting reencrypt:', err);
    res.status(500).json({ error: err?.message || 'Failed to request reencrypt' });
  }
});

// POST /admin/encryption/cleanup-plaintext - Remove plaintext backup fields
app.post('/admin/encryption/cleanup-plaintext', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID) {
      return res.status(503).json({ error: 'Appwrite not configured' });
    }
    
    const { collection, confirm } = req.body;
    
    if (confirm !== 'yes') {
      return res.status(400).json({ 
        error: 'Must confirm with { "confirm": "yes" } to remove plaintext backups' 
      });
    }
    
    // This is a dangerous operation - recommend using migration script
    res.status(400).json({
      error: 'Use migration script for cleanup',
      instructions: [
        'Run migration script to encrypt existing data first',
        'Then manually remove text_plain_removed_at fields via Appwrite Console',
        'Or create a custom cleanup script'
      ]
    });
    
    await logEncryptionAction('cleanup_requested', req.user?.userId || 'unknown', { collection });
  } catch (err) {
    console.error('Error requesting cleanup:', err);
    res.status(500).json({ error: err?.message || 'Failed to request cleanup' });
  }
});

// GET /admin/encryption/audit - Get encryption audit log
app.get('/admin/encryption/audit', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    if (!awDatabases || !APPWRITE_DATABASE_ID) {
      return res.json({ logs: [], message: 'Appwrite not configured' });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    
    try {
      const result = await awDatabases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_ENCRYPTION_AUDIT_COLLECTION_ID,
        [],
        limit
      );
      
      res.json({ logs: result.documents });
    } catch (err) {
      // Collection might not exist
      res.json({ logs: [], message: 'Audit collection not found' });
    }
  } catch (err) {
    console.error('Error getting encryption audit:', err);
    res.status(500).json({ error: err?.message || 'Failed to get audit log' });
  }
});

// ============================================================================
// END OF ENCRYPTION MANAGEMENT ENDPOINTS
// ============================================================================

const PORT = process.env.PORT || 4000;
const FORCE_TLS = process.env.FORCE_TLS === 'true';

server.listen(PORT, () => {
  console.log(`🚀 Socket.IO API server listening on port ${PORT}`);
  console.log(`📋 Environment: Gemini=${geminiClient ? '✅' : '❌'}, Appwrite=${awDatabases ? '✅' : '❌'}, Encryption=${ENCRYPTION_ENABLED ? '✅' : '❌'}`);
  
  // TLS check
  if (FORCE_TLS) {
    console.log('🔒 TLS enforcement enabled (FORCE_TLS=true)');
    console.log('   ⚠️  Ensure server is behind TLS proxy (nginx, cloudflare, etc.)');
  } else {
    console.warn('⚠️  TLS not enforced (set FORCE_TLS=true in production)');
    console.warn('   In production, use HTTPS/WSS and set FORCE_TLS=true');
  }
  
  // Security recommendations
  if (!ENCRYPTION_ENABLED) {
    console.warn('⚠️  Encryption disabled - sensitive data stored in plaintext');
    console.warn('   Set MASTER_KEY_BASE64 to enable encryption');
  }
  
  if (MASTER_KEY_BASE64 && !process.env.NODE_ENV?.includes('prod')) {
    console.warn('⚠️  PRODUCTION: Use KMS (AWS KMS/GCP KMS/HashiCorp Vault) instead of plaintext MASTER_KEY_BASE64');
  }
});
