require('dotenv').config(); // Check .env in current dir first
const { Client, Databases, ID } = require('node-appwrite');

const client = new Client();
const databases = new Databases(client);

// Configuration
const PARAMS = {
    endpoint: process.env.APPWRITE_ENDPOINT,
    projectId: process.env.APPWRITE_PROJECT_ID,
    apiKey: process.env.APPWRITE_API_KEY,
    databaseId: process.env.APPWRITE_DATABASE_ID,
};

// Validate Config
const missingParams = Object.entries(PARAMS).filter(([key, value]) => !value);
if (missingParams.length > 0) {
    console.error('❌ Missing configuration:', missingParams.map(([k]) => k).join(', '));
    process.exit(1);
}

// Initialize Client
client
    .setEndpoint(PARAMS.endpoint)
    .setProject(PARAMS.projectId)
    .setKey(PARAMS.apiKey);

// Schema Definition (Source of Truth: everything-about-chatbot.md)
const SCHEMA = [
    {
        name: 'Sessions',
        id: process.env.APPWRITE_SESSIONS_COLLECTION_ID || 'sessions',
        attributes: [
            { key: 'sessionId', type: 'string', size: 255, required: true },
            { key: 'status', type: 'string', size: 50, required: false },
            { key: 'assignedAgentId', type: 'string', size: 255, required: false },
            { key: 'userMeta', type: 'string', size: 10000, required: false }, // JSON string
            { key: 'theme', type: 'string', size: 5000, required: false }, // JSON string
            { key: 'startTime', type: 'string', size: 50, required: false }, // datetime string
            { key: 'lastSeen', type: 'string', size: 50, required: false }, // datetime string
            { key: 'aiPaused', type: 'boolean', required: false },
            { key: 'createdAt', type: 'string', size: 50, required: false }, // datetime string
            { key: 'updatedAt', type: 'string', size: 50, required: false }, // datetime string
        ],
        indexes: [
            { key: 'idx_sessionId', type: 'unique', attributes: ['sessionId'] }
        ]
    },
    {
        name: 'Messages',
        id: process.env.APPWRITE_MESSAGES_COLLECTION_ID || 'messages',
        attributes: [
            { key: 'sessionId', type: 'string', size: 255, required: true },
            { key: 'sender', type: 'string', size: 50, required: true },
            { key: 'text', type: 'string', size: 10000, required: true },
            { key: 'type', type: 'string', size: 50, required: false }, // text, image, file
            { key: 'attachmentUrl', type: 'string', size: 2000, required: false },
            { key: 'attachmentId', type: 'string', size: 255, required: false },
            { key: 'fileName', type: 'string', size: 255, required: false },
            { key: 'fileSize', type: 'integer', required: false },
            { key: 'mimeType', type: 'string', size: 100, required: false },
            { key: 'metadata', type: 'string', size: 5000, required: false }, // JSON string
            { key: 'confidence', type: 'double', required: false },
            { key: 'createdAt', type: 'string', size: 50, required: false }, // datetime string
        ],
        indexes: [
            { key: 'idx_sessionId', type: 'key', attributes: ['sessionId'] }
        ]
    },
    {
        name: 'Users',
        id: process.env.APPWRITE_USERS_COLLECTION_ID || 'users',
        attributes: [
            { key: 'userId', type: 'string', size: 255, required: true },
            { key: 'email', type: 'string', size: 255, required: true },
            { key: 'name', type: 'string', size: 255, required: true },
            { key: 'roles', type: 'string', size: 100, required: false, array: true },
            { key: 'status', type: 'string', size: 50, required: false }, // online, offline, busy
            { key: 'createdAt', type: 'string', size: 50, required: false }, // datetime string
            { key: 'updatedAt', type: 'string', size: 50, required: false }, // datetime string
        ],
        indexes: [
            { key: 'idx_userId', type: 'unique', attributes: ['userId'] },
            { key: 'idx_email', type: 'unique', attributes: ['email'] }
        ]
    },
    {
        name: 'AI Accuracy',
        id: process.env.APPWRITE_AI_ACCURACY_COLLECTION_ID || 'ai_accuracy',
        attributes: [
            { key: 'sessionId', type: 'string', size: 255, required: false },
            { key: 'aiText', type: 'string', size: 10000, required: false },
            { key: 'confidence', type: 'double', required: false },
            { key: 'tokens', type: 'integer', required: false },
            { key: 'latencyMs', type: 'integer', required: false },
            { key: 'responseType', type: 'string', size: 50, required: false },
            { key: 'humanMark', type: 'string', size: 50, required: false },
            { key: 'evaluation', type: 'string', size: 1000, required: false },
            { key: 'metadata', type: 'string', size: 5000, required: false }, // JSON string
            { key: 'createdAt', type: 'string', size: 50, required: false }, // datetime string
        ],
        indexes: [
            { key: 'idx_sessionId', type: 'key', attributes: ['sessionId'] }
        ]
    },
    {
        name: 'Role Changes',
        id: process.env.APPWRITE_ROLE_CHANGES_COLLECTION_ID || 'roleChanges',
        attributes: [
            { key: 'userId', type: 'string', size: 255, required: false },
            { key: 'oldRoles', type: 'string', size: 100, required: false, array: true },
            { key: 'newRoles', type: 'string', size: 100, required: false, array: true },
            { key: 'changedBy', type: 'string', size: 255, required: false },
            { key: 'createdAt', type: 'string', size: 50, required: false }, // datetime string
        ],
        indexes: [
            { key: 'idx_userId', type: 'key', attributes: ['userId'] }
        ]
    },
    {
        name: 'Accuracy Audit',
        id: process.env.APPWRITE_ACCURACY_AUDIT_COLLECTION_ID || 'accuracy_audit',
        attributes: [
            { key: 'accuracyId', type: 'string', size: 255, required: false },
            { key: 'action', type: 'string', size: 50, required: false },
            { key: 'userId', type: 'string', size: 255, required: false },
            { key: 'metadata', type: 'string', size: 5000, required: false }, // JSON string
            { key: 'createdAt', type: 'string', size: 50, required: false }, // datetime string
        ],
        indexes: [
            { key: 'idx_accuracyId', type: 'key', attributes: ['accuracyId'] }
        ]
    },
    {
        name: 'Tickets',
        id: process.env.APPWRITE_TICKETS_ID || 'tickets',
        attributes: [
            { key: 'ticketId', type: 'string', size: 255, required: true },
            { key: 'name', type: 'string', size: 255, required: true },
            { key: 'email', type: 'string', size: 255, required: true },
            { key: 'mobile', type: 'string', size: 20, required: false },
            { key: 'query', type: 'string', size: 5000, required: true },
            { key: 'sessionId', type: 'string', size: 255, required: false },
            { key: 'status', type: 'string', size: 50, required: true },
            { key: 'assignedAgentId', type: 'string', size: 255, required: false },
            { key: 'assignedAgentName', type: 'string', size: 255, required: false },
            { key: 'resolvedAt', type: 'string', size: 50, required: false }, // datetime string
            { key: 'resolutionResponse', type: 'string', size: 5000, required: false },
            { key: 'resolvedBy', type: 'string', size: 255, required: false },
            { key: 'resolvedByName', type: 'string', size: 255, required: false },
            { key: 'resolvedByEmail', type: 'string', size: 255, required: false },
            { key: 'createdAt', type: 'string', size: 50, required: false }, // datetime string
        ],
        indexes: [
            { key: 'idx_ticketId', type: 'unique', attributes: ['ticketId'] },
            { key: 'idx_email', type: 'key', attributes: ['email'] },
            { key: 'idx_sessionId', type: 'key', attributes: ['sessionId'] }
        ]
    },
    {
        name: 'Notifications',
        id: process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID || 'notifications',
        attributes: [
            { key: 'type', type: 'string', size: 50, required: true },
            { key: 'content', type: 'string', size: 500, required: true },
            { key: 'sessionId', type: 'string', size: 255, required: true },
            { key: 'targetUserId', type: 'string', size: 255, required: false },
            { key: 'isRead', type: 'boolean', required: true },
            { key: 'createdAt', type: 'string', size: 50, required: false }, // datetime string
        ],
        indexes: [
            { key: 'idx_sessionId', type: 'key', attributes: ['sessionId'] },
            { key: 'idx_targetUserId', type: 'key', attributes: ['targetUserId'] }
        ]
    },
    {
        name: 'Canned Responses',
        id: process.env.APPWRITE_CANNED_RESPONSES_COLLECTION_ID || 'canned_responses',
        attributes: [
            { key: 'shortcut', type: 'string', size: 50, required: true },
            { key: 'content', type: 'string', size: 5000, required: true },
            { key: 'category', type: 'string', size: 100, required: false },
            { key: 'createdAt', type: 'string', size: 50, required: false }, // datetime string
            { key: 'updatedAt', type: 'string', size: 50, required: false }, // datetime string
        ],
        indexes: [
            { key: 'idx_shortcut', type: 'unique', attributes: ['shortcut'] }
        ]
    }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createAttribute(collectionId, attr) {
    console.log(`      Creating attribute '${attr.key}'...`);
    try {
        if (attr.type === 'string') {
            await databases.createStringAttribute(PARAMS.databaseId, collectionId, attr.key, attr.size, attr.required, undefined, attr.array);
        } else if (attr.type === 'integer') {
            await databases.createIntegerAttribute(PARAMS.databaseId, collectionId, attr.key, attr.required, 0, 2147483647, undefined, attr.array);
        } else if (attr.type === 'boolean') {
            await databases.createBooleanAttribute(PARAMS.databaseId, collectionId, attr.key, attr.required, undefined, attr.array);
        } else if (attr.type === 'double') {
            await databases.createFloatAttribute(PARAMS.databaseId, collectionId, attr.key, attr.required, undefined, undefined, attr.array);
        }
        await sleep(500); // Wait for attribute creation
    } catch (err) {
        if (err.code === 409) {
            console.log(`      ⚠️  Attribute '${attr.key}' already exists - skipping`);
        } else {
            console.error(`      ❌ Failed to create attribute '${attr.key}':`, err.message);
        }
    }
}

async function createIndex(collectionId, idx) {
    console.log(`      Creating index '${idx.key}'...`);
    try {
        await databases.createIndex(PARAMS.databaseId, collectionId, idx.key, idx.type, idx.attributes);
    } catch (err) {
        if (err.code === 409) {
            console.log(`      ⚠️  Index '${idx.key}' already exists - skipping`);
        } else {
            console.error(`      ❌ Failed to create index '${idx.key}':`, err.message);
        }
    }
}

async function main() {
    console.log(`🚀 Starting Database Migration for Project: ${PARAMS.projectId}`);
    console.log(`📂 Target Database ID: ${PARAMS.databaseId}`);

    // Check if database exists, create if not
    try {
        await databases.get(PARAMS.databaseId);
        console.log(`✅ Database exists`);
    } catch (err) {
        if (err.code === 404) {
            console.log(`⚠️  Database ${PARAMS.databaseId} not found. Creating it...`);
            try {
                await databases.create(PARAMS.databaseId, 'ChatbotDB');
                console.log(`✅ Created database: ChatbotDB (${PARAMS.databaseId})`);
            } catch (createErr) {
                console.error(`❌ Failed to create database:`, createErr.message);
                process.exit(1);
            }
        } else {
            console.error(`❌ Error checking database:`, err.message);
            process.exit(1);
        }
    }

    for (const col of SCHEMA) {
        console.log(`\n📦 Processing Collection: ${col.name} (${col.id})`);

        // 1. Create Collection
        try {
            await databases.createCollection(PARAMS.databaseId, col.id, col.name);
            console.log(`   ✅ Created collection`);
        } catch (err) {
            if (err.code === 409) {
                console.log(`   ℹ️  Collection already exists`);
            } else {
                console.error(`   ❌ Failed to create collection:`, err.message);
                continue; // Skip if collection creation fails drastically
            }
        }

        // 2. Create Attributes
        console.log(`   ⚙️  Creating attributes...`);
        for (const attr of col.attributes) {
            await createAttribute(col.id, attr);
        }

        // 3. Wait for attributes to process
        console.log(`   ⏳ Waiting for attributes to index (2s)...`);
        await sleep(2000);

        // 4. Create Indexes
        if (col.indexes && col.indexes.length > 0) {
            console.log(`   🔍 Creating indexes...`);
            for (const idx of col.indexes) {
                await createIndex(col.id, idx);
                await sleep(500); // Small delay between indexes
            }
        }
    }

    console.log(`\n✅ Migration Complete!`);
}

main().catch(console.error);
