/**
 * Migration Script: Create AI Accuracy Collections
 * Creates ai_accuracy and accuracy_audit collections in Appwrite
 * Run: node migrate_create_ai_accuracy_collection.js
 */

require('dotenv').config();

const { Client, Databases, ID } = require('node-appwrite');

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !APPWRITE_DATABASE_ID) {
  console.error('❌ Missing required Appwrite environment variables:');
  console.error('   Required: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID');
  process.exit(1);
}

const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT);
client.setProject(APPWRITE_PROJECT_ID);
client.setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

async function createCollection(name, collectionId) {
  try {
    console.log(`📦 Creating collection: ${name} (${collectionId})...`);
    await databases.createCollection(APPWRITE_DATABASE_ID, collectionId, name);
    console.log(`✅ Created collection: ${name}`);
    return true;
  } catch (err) {
    if (err.code === 409) {
      console.log(`ℹ️  Collection ${name} already exists, skipping...`);
      return true;
    }
    console.error(`❌ Failed to create collection ${name}:`, err.message);
    return false;
  }
}

async function createStringAttribute(collectionId, key, size = 255, required = false, array = false, unique = false) {
  try {
    console.log(`   Adding string attribute: ${key}...`);
    // Appwrite createStringAttribute signature: (databaseId, collectionId, key, size, required, array, default, unique)
    // Try multiple approaches for default parameter (null, empty string, undefined)
    let created = false;
    const attempts = [
      // Try 1: Pass null
      async () => {
        await databases.createStringAttribute(
          APPWRITE_DATABASE_ID,
          collectionId,
          key,
          size,
          required,
          array,
          null, // null for no default
          unique
        );
      },
      // Try 2: Pass empty string
      async () => {
        await databases.createStringAttribute(
          APPWRITE_DATABASE_ID,
          collectionId,
          key,
          size,
          required,
          array,
          '', // empty string
          unique
        );
      },
      // Try 3: Use undefined (might skip the parameter)
      async () => {
        await databases.createStringAttribute(
          APPWRITE_DATABASE_ID,
          collectionId,
          key,
          size,
          required,
          array,
          undefined, // undefined
          unique
        );
      }
    ];
    
    for (let i = 0; i < attempts.length && !created; i++) {
      try {
        await attempts[i]();
        console.log(`   ✅ Added: ${key} (attempt ${i + 1})`);
        created = true;
      } catch (attemptErr) {
        if (attemptErr.code === 409) {
          console.log(`   ℹ️  Attribute ${key} already exists, skipping...`);
          return true;
        }
        if (i === attempts.length - 1) {
          // Last attempt failed
          console.error(`   ❌ Failed to add ${key} after ${attempts.length} attempts: ${attemptErr.message}`);
          return false;
        }
        // Continue to next attempt
      }
    }
    
    return created;
  } catch (err) {
    if (err.code === 409) {
      console.log(`   ℹ️  Attribute ${key} already exists, skipping...`);
      return true;
    }
    console.error(`   ❌ Failed to add ${key}:`, err.message);
    return false;
  }
}

async function createIntegerAttribute(collectionId, key, required = false, min = null, max = null, defaultVal = null) {
  try {
    console.log(`   Adding integer attribute: ${key}...`);
    // Appwrite doesn't accept null as default - omit if null
    if (defaultVal === null || defaultVal === undefined) {
      await databases.createIntegerAttribute(APPWRITE_DATABASE_ID, collectionId, key, required, min, max);
    } else {
      await databases.createIntegerAttribute(APPWRITE_DATABASE_ID, collectionId, key, required, min, max, defaultVal);
    }
    console.log(`   ✅ Added: ${key}`);
    return true;
  } catch (err) {
    if (err.code === 409) {
      console.log(`   ℹ️  Attribute ${key} already exists, skipping...`);
      return true;
    }
    console.error(`   ❌ Failed to add ${key}:`, err.message);
    return false;
  }
}

async function createFloatAttribute(collectionId, key, required = false, min = null, max = null, defaultVal = null) {
  try {
    console.log(`   Adding float attribute: ${key}...`);
    // Appwrite doesn't accept null as default - omit if null
    if (defaultVal === null || defaultVal === undefined) {
      await databases.createFloatAttribute(APPWRITE_DATABASE_ID, collectionId, key, required, min, max);
    } else {
      await databases.createFloatAttribute(APPWRITE_DATABASE_ID, collectionId, key, required, min, max, defaultVal);
    }
    console.log(`   ✅ Added: ${key}`);
    return true;
  } catch (err) {
    if (err.code === 409) {
      console.log(`   ℹ️  Attribute ${key} already exists, skipping...`);
      return true;
    }
    console.error(`   ❌ Failed to add ${key}:`, err.message);
    return false;
  }
}

async function createDatetimeAttribute(collectionId, key, required = false) {
  try {
    console.log(`   Adding datetime attribute: ${key}...`);
    await databases.createDatetimeAttribute(APPWRITE_DATABASE_ID, collectionId, key, required);
    console.log(`   ✅ Added: ${key}`);
    return true;
  } catch (err) {
    if (err.code === 409) {
      console.log(`   ℹ️  Attribute ${key} already exists, skipping...`);
      return true;
    }
    console.error(`   ❌ Failed to add ${key}:`, err.message);
    return false;
  }
}

async function testConnection() {
  try {
    await databases.listCollections(APPWRITE_DATABASE_ID);
    console.log('✅ Connected to Appwrite');
    return true;
  } catch (err) {
    if (err.code === 404) {
      console.error('❌ Database not found. Please check APPWRITE_DATABASE_ID');
      return false;
    }
    console.error('❌ Failed to connect to Appwrite:', err.message);
    return false;
  }
}

async function migrate() {
  console.log('🚀 Starting AI Accuracy Collections Migration...\n');
  
  if (!(await testConnection())) {
    process.exit(1);
  }
  
  console.log('');
  
  // Create ai_accuracy collection
  const accuracyCreated = await createCollection('AI Accuracy', 'ai_accuracy');
  if (accuracyCreated) {
    console.log('📝 Adding attributes to ai_accuracy...');
    
    await createStringAttribute('ai_accuracy', 'messageId', 255, false, false);
    await createStringAttribute('ai_accuracy', 'sessionId', 255, true, false);
    await createStringAttribute('ai_accuracy', 'aiText', 10000, false, false); // Large text field
    await createFloatAttribute('ai_accuracy', 'confidence', false, 0, 1);
    await createIntegerAttribute('ai_accuracy', 'tokens', false);
    await createIntegerAttribute('ai_accuracy', 'latencyMs', false);
    await createStringAttribute('ai_accuracy', 'responseType', 50, false, false); // "ai" | "fallback" | "stub"
    await createStringAttribute('ai_accuracy', 'humanMark', 50, false, false); // "up" | "down" | "flag" | null
    await createStringAttribute('ai_accuracy', 'evaluation', 5000, false, false); // Admin notes
    await createDatetimeAttribute('ai_accuracy', 'createdAt', true);
    await createStringAttribute('ai_accuracy', 'metadata', 10000, false, false); // JSON string
    
    console.log('✅ ai_accuracy collection ready\n');
  }
  
  // Create accuracy_audit collection
  const auditCreated = await createCollection('Accuracy Audit', 'accuracy_audit');
  if (auditCreated) {
    console.log('📝 Adding attributes to accuracy_audit...');
    
    await createStringAttribute('accuracy_audit', 'accuracyId', 255, true, false);
    await createStringAttribute('accuracy_audit', 'adminId', 255, true, false);
    await createStringAttribute('accuracy_audit', 'action', 50, true, false); // "evaluate" | "feedback"
    await createStringAttribute('accuracy_audit', 'note', 5000, false, false);
    await createDatetimeAttribute('accuracy_audit', 'ts', true);
    
    console.log('✅ accuracy_audit collection ready\n');
  }
  
  console.log('✅ Migration completed!');
  console.log('\n📋 Next steps:');
  console.log('   1. Verify collections in Appwrite Console');
  console.log('   2. Create indexes on sessionId, createdAt, humanMark for better query performance');
  console.log('   3. Restart your API server');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

