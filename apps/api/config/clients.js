const { createChatService } = require('../services/chatService');
const { sessionAssignments } = require('./state');
require('dotenv').config();

// Encryption library
let encryption = null;
try {
    encryption = require('../lib/encryption');
    console.log('✅ Encryption library loaded');
} catch (e) {
    console.warn('⚠️  Encryption library not available:', e?.message || e);
}

// Appwrite client initialization
let awClient = null;
let awDatabases = null;
let Query = null;

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPWRITE_SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION_ID;
const APPWRITE_MESSAGES_COLLECTION_ID = process.env.APPWRITE_MESSAGES_COLLECTION_ID;
const APPWRITE_NOTIFICATIONS_COLLECTION_ID = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID || 'notifications';
const APPWRITE_TICKETS_COLLECTION_ID = process.env.APPWRITE_TICKETS_COLLECTION_ID || 'tickets';
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

// Resend email client
let resend = null;
try {
    const { Resend } = require('resend');
    if (process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
        console.log('✅ Resend email client initialized');
    } else {
        console.warn('⚠️  RESEND_API_KEY missing — email features disabled');
    }
} catch (e) {
    console.warn('⚠️  Resend package not available — email features disabled:', e?.message || e);
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
        // Use models that work with free tier (gemini-2.5-flash-lite is preferred)
        const modelCandidates = preferredModel
            ? [preferredModel]
            : ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
        geminiModelName = modelCandidates[0];
        geminiModel = geminiClient.getGenerativeModel({ model: geminiModelName });
        console.log(`✅ Gemini client initialized (model: ${geminiModelName} - will fallback if unavailable)`);
    } else {
        console.warn('⚠️  GEMINI_API_KEY missing — running in stub mode');
    }
} catch (e) {
    console.warn('⚠️  @google/generative-ai package not available — running in stub mode:', e?.message || e);
}


// Chat Service Initialization
let chatService = null;
if (awDatabases && APPWRITE_DATABASE_ID) {
    chatService = createChatService({
        databases: awDatabases,
        databaseId: APPWRITE_DATABASE_ID,
        sessionsCollectionId: APPWRITE_SESSIONS_COLLECTION_ID,
        messagesCollectionId: APPWRITE_MESSAGES_COLLECTION_ID,
        messagesCollectionId: APPWRITE_MESSAGES_COLLECTION_ID,
        sessionAssignments: sessionAssignments,
        agentSockets: require('./state').agentSockets
    });
    console.log('✅ Chat Service initialized');
} else {
    console.warn('⚠️  Chat Service NOT initialized (DB not ready)');
}

module.exports = {
    awClient,
    awDatabases,
    Query,
    resend,
    geminiClient,
    geminiModel,
    geminiModelName,
    encryption,
    chatService,
    config: {
        APPWRITE_ENDPOINT,
        APPWRITE_PROJECT_ID,
        APPWRITE_API_KEY,
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        APPWRITE_MESSAGES_COLLECTION_ID,
        APPWRITE_NOTIFICATIONS_COLLECTION_ID,
        APPWRITE_USERS_COLLECTION_ID,
        APPWRITE_TICKETS_COLLECTION_ID,
        APPWRITE_ROLE_CHANGES_COLLECTION_ID,
        APPWRITE_AI_ACCURACY_COLLECTION_ID,
        APPWRITE_ACCURACY_AUDIT_COLLECTION_ID,
        ACCURACY_RETENTION_DAYS,
        ACCURACY_MAX_SCAN_ROWS,
        REDACT_PII,
        MASTER_KEY_BASE64,
        ENCRYPTION_ENABLED
    }
};
