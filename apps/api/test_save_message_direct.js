/**
 * Direct Test: Save Message to Appwrite
 * 
 * This script directly tests saving a message to Appwrite
 * to verify the connection and schema are correct.
 * 
 * Usage:
 *   node test_save_message_direct.js
 */

require('dotenv').config();
const { Client, Databases } = require('node-appwrite');

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPWRITE_MESSAGES_COLLECTION_ID = process.env.APPWRITE_MESSAGES_COLLECTION_ID;
const APPWRITE_SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION_ID;

console.log('🧪 Direct Message Save Test');
console.log('============================\n');

// Check configuration
if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error('❌ Missing Appwrite configuration');
  console.error('   Required: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

if (!APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
  console.error('❌ Missing database/collection IDs');
  console.error(`   APPWRITE_DATABASE_ID: ${APPWRITE_DATABASE_ID ? '✅' : '❌'}`);
  console.error(`   APPWRITE_MESSAGES_COLLECTION_ID: ${APPWRITE_MESSAGES_COLLECTION_ID ? '✅' : '❌'}`);
  process.exit(1);
}

const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT);
client.setProject(APPWRITE_PROJECT_ID);
client.setKey(APPWRITE_API_KEY);
const db = new Databases(client);

async function testSaveMessage() {
  const testSessionId = `test_${Date.now()}`;
  const testText = 'Test message from direct save script';
  const now = new Date().toISOString();
  
  console.log('📋 Test Configuration:');
  console.log(`   Database ID: ${APPWRITE_DATABASE_ID}`);
  console.log(`   Messages Collection ID: ${APPWRITE_MESSAGES_COLLECTION_ID}`);
  console.log(`   Test Session ID: ${testSessionId}`);
  console.log(`   Test Message: "${testText}"\n`);
  
  // Test 1: Create a test session first
  console.log('📝 Step 1: Creating test session...');
  try {
    await db.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_SESSIONS_COLLECTION_ID,
      testSessionId,
      {
        sessionId: testSessionId,
        status: 'active',
        lastSeen: now,
        startTime: now,
        userMeta: '{}',
        theme: '{}'
      }
    );
    console.log(`✅ Test session created: ${testSessionId}\n`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`ℹ️  Test session already exists: ${testSessionId}\n`);
    } else {
      console.error(`❌ Failed to create test session:`, err.message);
      console.error(`   Error code: ${err.code}, Type: ${err.type}`);
      process.exit(1);
    }
  }
  
  // Test 2: Save a test message
  console.log('📝 Step 2: Saving test message...');
  const messageDoc = {
    sessionId: testSessionId,
    sender: 'user',
    text: testText,
    createdAt: now,
    metadata: '{}',
    confidence: null
  };
  
  console.log('📤 Document to save:');
  console.log(JSON.stringify(messageDoc, null, 2));
  console.log();
  
  try {
    const result = await db.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_MESSAGES_COLLECTION_ID,
      'unique()',
      messageDoc
    );
    console.log(`✅ Message saved successfully!`);
    console.log(`   Document ID: ${result.$id}`);
    console.log(`   Session ID: ${result.sessionId}`);
    console.log(`   Sender: ${result.sender}`);
    console.log(`   Text: ${result.text}`);
    console.log(`   Created At: ${result.createdAt || result.$createdAt}`);
    console.log();
    
    // Test 3: Verify we can read it back
    console.log('📝 Step 3: Verifying message can be read back...');
    const readResult = await db.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_MESSAGES_COLLECTION_ID,
      result.$id
    );
    console.log(`✅ Message read back successfully!`);
    console.log(`   Document ID: ${readResult.$id}`);
    console.log(`   Text: ${readResult.text}`);
    console.log();
    
    console.log('✅ All tests passed! Appwrite is working correctly.');
    console.log(`\n💡 You can now check Appwrite Console to see the test message.`);
    console.log(`   Session ID: ${testSessionId}`);
    console.log(`   Message ID: ${result.$id}`);
    
  } catch (err) {
    console.error(`❌ Failed to save message:`, err.message);
    console.error(`   Error code: ${err.code}`);
    console.error(`   Error type: ${err.type}`);
    console.error(`   Full error:`, JSON.stringify(err, Object.getOwnPropertyNames(err)));
    
    if (err.code === 400) {
      console.error(`\n💡 Bad Request - This usually means:`);
      console.error(`   1. Collection attributes don't match the document structure`);
      console.error(`   2. Required attributes are missing`);
      console.error(`   3. Attribute types don't match (e.g., string vs integer)`);
      console.error(`\n🔧 Check your messages collection attributes in Appwrite Console:`);
      console.error(`   Required: sessionId (string), sender (string), text (string), createdAt (datetime), metadata (string), confidence (double/nullable)`);
    } else if (err.code === 401) {
      console.error(`\n💡 Authentication failed - Check API key scopes`);
    } else if (err.code === 403) {
      console.error(`\n💡 Permission denied - Check API key has write access`);
    } else if (err.code === 404) {
      console.error(`\n💡 Collection or Database not found - Check IDs are correct`);
    }
    
    process.exit(1);
  }
}

testSaveMessage().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

