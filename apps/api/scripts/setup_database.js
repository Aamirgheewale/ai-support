require('dotenv').config();
const { Client, Databases } = require('node-appwrite');

const client = new Client();
const databases = new Databases(client);

// Configuration from Environment Variables
const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error('❌ Error: Missing required environment variables (APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY)');
    process.exit(1);
}

client
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

// ==========================================
// 🏗️ BLUEPRINT: SCHEMA DEFINITION (REVERSE ENGINEERED)
// ==========================================
const SCHEMA = {
    databaseId: process.env.APPWRITE_DATABASE_ID || 'ai_support_db',
    databaseName: "AI Support Database",

    collections: [
        // 1. Users Collection
        {
            name: "Users",
            id: "users", // Matches APPWRITE_USERS_COLLECTION_ID
            attributes: [
                { key: "userId", type: "string", size: 255, required: true },
                { key: "email", type: "string", size: 255, required: true }, // x-email valid
                { key: "name", type: "string", size: 255, required: false },
                { key: "roles", type: "string", size: 255, required: false, array: true }, // ['admin', 'agent']
                { key: "accountStatus", type: "string", size: 50, required: false, default: "pending" }, // 'active', 'pending', 'rejected'
                { key: "permissions", type: "string", size: 255, required: false, array: true },
                { key: "status", type: "string", size: 50, required: false, default: "offline" }, // 'online', 'away'
                { key: "lastSeen", type: "string", size: 64, required: false }, // ISO Date
                { key: "prefs", type: "string", size: 10000, required: false }, // JSON Preferences
                { key: "encrypted_notes", type: "string", size: 5000, required: false } // For Encryption
            ]
        },

        // 2. Chat Sessions
        {
            name: "Chat Sessions",
            id: process.env.APPWRITE_SESSIONS_COLLECTION_ID || "sessions",
            attributes: [
                { key: "sessionId", type: "string", size: 255, required: true },
                { key: "status", type: "string", size: 50, required: true }, // 'active', 'closed', 'agent_assigned'
                { key: "startTime", type: "string", size: 64, required: false },
                { key: "lastSeen", type: "string", size: 64, required: false },
                { key: "theme", type: "string", size: 10000, required: false, default: "{}" }, // JSON
                { key: "userMeta", type: "string", size: 10000, required: false, default: "{}" }, // JSON User Metadata
                { key: "assignedAgent", type: "string", size: 255, required: false }, // Agent ID
                { key: "aiPaused", type: "boolean", required: false, default: false },
                { key: "encrypted_userMeta", type: "string", size: 10000, required: false } // For Encryption
            ]
        },

        // 3. Chat Messages
        {
            name: "Chat Messages",
            id: process.env.APPWRITE_MESSAGES_COLLECTION_ID || "messages",
            attributes: [
                { key: "sessionId", type: "string", size: 255, required: true },
                { key: "sender", type: "string", size: 50, required: true }, // 'user', 'bot', 'agent', 'system', 'internal'
                { key: "text", type: "string", size: 5000, required: true },
                { key: "createdAt", type: "string", size: 64, required: true },
                { key: "metadata", type: "string", size: 255, required: false }, // JSON str (truncated)
                { key: "confidence", type: "double", required: false },
                { key: "type", type: "string", size: 50, required: false }, // 'text', 'image', 'auto_reply'
                { key: "attachmentUrl", type: "string", size: 2048, required: false },
                { key: "visibility", type: "string", size: 20, required: false, default: "public" }, // 'public', 'internal'
                { key: "encrypted", type: "string", size: 10000, required: false } // For encrypted text
            ]
        },

        // 4. Notifications
        {
            name: "Notifications",
            id: process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID || "notifications",
            attributes: [
                { key: "targetUserId", type: "string", size: 255, required: true },
                { key: "title", type: "string", size: 255, required: false },
                { key: "content", type: "string", size: 5000, required: true }, // Message body
                { key: "type", type: "string", size: 50, required: true }, // 'system', 'assignment', 'request_agent'
                { key: "isRead", type: "boolean", required: true, default: false },
                { key: "severity", type: "string", size: 20, required: false, default: "info" },
                { key: "sessionId", type: "string", size: 255, required: false },
                { key: "createdAt", type: "string", size: 64, required: false }
            ]
        },

        // 5. Support Tickets
        {
            name: "Tickets",
            id: process.env.APPWRITE_TICKETS_COLLECTION_ID || "tickets",
            attributes: [
                { key: "ticketId", type: "string", size: 255, required: true },
                { key: "name", type: "string", size: 255, required: true },
                { key: "email", type: "string", size: 255, required: true },
                { key: "mobile", type: "string", size: 50, required: false },
                { key: "query", type: "string", size: 5000, required: true },
                { key: "sessionId", type: "string", size: 255, required: false },
                { key: "status", type: "string", size: 50, required: false, default: "pending" }, // 'pending', 'resolved'
                { key: "createdAt", type: "string", size: 64, required: false },
                { key: "resolvedBy", type: "string", size: 255, required: false },
                { key: "resolvedAt", type: "string", size: 64, required: false },
                { key: "resolutionResponse", type: "string", size: 10000, required: false }
            ]
        },

        // 6. App Settings (Global Config)
        {
            name: "App Settings",
            id: "app_settings", // Fixed ID in settingsService.js
            attributes: [
                { key: "key", type: "string", size: 255, required: true },
                { key: "value", type: "string", size: 10000, required: true }
            ]
        },

        // 7. LLM Settings (Provider Configurations)
        {
            name: "LLM Settings",
            id: process.env.APPWRITE_LLM_SETTINGS_COLLECTION_ID || "llm_settings",
            attributes: [
                { key: "provider", type: "string", size: 50, required: true }, // 'gemini', 'openai', 'anthropic'
                { key: "model", type: "string", size: 100, required: true }, // 'gemini-1.5-flash', 'gpt-4o'
                { key: "isActive", type: "boolean", required: false, default: false },
                { key: "baseUrl", type: "string", size: 2048, required: false },
                { key: "encryptedApiKey", type: "string", size: 5000, required: false }
            ]
        },

        // 8. AI Accuracy Logs
        {
            name: "AI Accuracy",
            id: process.env.APPWRITE_AI_ACCURACY_COLLECTION_ID || "ai_accuracy",
            attributes: [
                { key: "sessionId", type: "string", size: 255, required: true },
                { key: "aiText", type: "string", size: 10000, required: false }, // Truncated response
                { key: "confidence", type: "double", required: false },
                { key: "latencyMs", type: "integer", required: false },
                { key: "metadata", type: "string", size: 255, required: false }, // Context info
                { key: "responseType", type: "string", size: 50, required: false }, // 'auto_reply', 'llm_response'
                { key: "humanMark", type: "string", size: 20, required: false }, // 'helpful', 'unhelpful' (for RLHF)
                { key: "createdAt", type: "string", size: 64, required: false },
                { key: "encrypted_aiText", type: "string", size: 10000, required: false }
            ]
        },

        // 9. Role Changes Audit
        {
            name: "Role Changes",
            id: "roleChanges", // Fixed ID in authController.js
            attributes: [
                { key: "userId", type: "string", size: 255, required: true },
                { key: "changedBy", type: "string", size: 255, required: true },
                { key: "oldRoles", type: "string", size: 1000, required: false, array: true },
                { key: "newRoles", type: "string", size: 1000, required: false, array: true },
                { key: "createdAt", type: "string", size: 64, required: true }
            ]
        },

        // 10. Encryption Audit
        {
            name: "Encryption Audit",
            id: "encryption_audit", // Fixed ID in systemController.js
            attributes: [
                { key: "action", type: "string", size: 100, required: true },
                { key: "adminId", type: "string", size: 255, required: true },
                { key: "stats", type: "string", size: 5000, required: false }, // JSON stats
                { key: "ts", type: "string", size: 64, required: true }
            ]
        },

        // 11. Canned Responses / Auto-Replies
        {
            name: "Canned Responses",
            id: "canned_responses", // Fixed ID in cannedResponseController.js
            attributes: [
                { key: "shortcut", type: "string", size: 255, required: true }, // trigger keyword or shortcut
                { key: "content", type: "string", size: 5000, required: true },
                { key: "category", type: "string", size: 100, required: false },
                { key: "match_type", type: "string", size: 50, required: false, default: "shortcut" }, // 'shortcut', 'exact', 'partial', 'keyword'
                { key: "is_active", type: "boolean", required: false, default: true }
            ]
        }
    ]
};

// ==========================================
// 🛠️ THE BUILDER: SETUP LOGIC
// ==========================================
async function setup() {
    console.log('🚀 Starting Database Setup...');
    console.log(`📡 Endpoint: ${ENDPOINT}`);
    console.log(`🆔 Project: ${PROJECT_ID}`);
    console.log(`💾 Target Database: ${SCHEMA.databaseId}`);

    try {
        // 1. Check/Create Database
        try {
            await databases.get(SCHEMA.databaseId);
            console.log(`✅ Database '${SCHEMA.databaseName}' (${SCHEMA.databaseId}) exists.`);
        } catch (error) {
            if (error.code === 404) {
                console.log(`⚠️ Database not found. Creating '${SCHEMA.databaseName}'...`);
                await databases.create(SCHEMA.databaseId, SCHEMA.databaseName);
                console.log(`✅ Created Database '${SCHEMA.databaseName}'`);
            } else {
                throw error;
            }
        }

        // 2. Loop Collections
        for (const col of SCHEMA.collections) {
            console.log(`\n🔍 Checking Collection: ${col.name} (${col.id})...`);

            try {
                await databases.getCollection(SCHEMA.databaseId, col.id);
                console.log(`   ✅ Collection exists.`);
            } catch (error) {
                if (error.code === 404) {
                    console.log(`   ⚠️ Collection not found. Creating...`);
                    await databases.createCollection(SCHEMA.databaseId, col.id, col.name);
                    console.log(`   ✅ Created Collection: ${col.name}`);
                } else {
                    console.error(`   ❌ Error checking collection ${col.name}:`, error.message);
                    continue; // Skip to next collection
                }
            }

            // 3. Loop Attributes
            const existingAttributes = await databases.listAttributes(SCHEMA.databaseId, col.id);
            const existingKeys = existingAttributes.attributes.map(a => a.key);

            for (const attr of col.attributes) {
                if (existingKeys.includes(attr.key)) {
                    console.log(`       🔹 Attribute '${attr.key}' exists.`);
                    continue;
                }

                console.log(`       ➕ Creating Attribute: '${attr.key}' defined as ${attr.type}...`);

                try {
                    switch (attr.type) {
                        case 'string':
                            await databases.createStringAttribute(SCHEMA.databaseId, col.id, attr.key, attr.size || 255, attr.required, attr.default, attr.array || false);
                            break;
                        case 'integer':
                            await databases.createIntegerAttribute(SCHEMA.databaseId, col.id, attr.key, attr.required, 0, 9999999999, attr.default, attr.array || false);
                            break;
                        case 'boolean':
                            await databases.createBooleanAttribute(SCHEMA.databaseId, col.id, attr.key, attr.required, attr.default, attr.array || false);
                            break;
                        case 'float':
                        case 'double':
                            await databases.createFloatAttribute(SCHEMA.databaseId, col.id, attr.key, attr.required, 0, 9999999999, attr.default, attr.array || false);
                            break;
                        case 'email':
                            await databases.createEmailAttribute(SCHEMA.databaseId, col.id, attr.key, attr.required, attr.default, attr.array || false);
                            break;
                        case 'url':
                            await databases.createUrlAttribute(SCHEMA.databaseId, col.id, attr.key, attr.required, attr.default, attr.array || false);
                            break;
                        case 'enum':
                            await databases.createEnumAttribute(SCHEMA.databaseId, col.id, attr.key, attr.elements, attr.required, attr.default, attr.array || false);
                            break;
                        default:
                            console.warn(`       ⚠️ Unknown attribute type '${attr.type}' for ${attr.key}`);
                    }
                    console.log(`       ✅ Created Attribute: ${attr.key}`);

                    // 4. Wait to avoid rate limits / async race conditions
                    await new Promise(r => setTimeout(r, 500));

                } catch (attrError) {
                    console.error(`       ❌ Failed to create attribute '${attr.key}':`, attrError.message);
                }
            }
        }

        console.log('\n✨ Database Setup Complete! ✨');

    } catch (error) {
        console.error('\n❌ Fatal Setup Error:', error);
    }
}

// Execute
setup();
