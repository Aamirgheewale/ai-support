// Test script to verify message saving works
require('dotenv').config();

(async () => {
  try {
    const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
    const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
    const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
    const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
    const APPWRITE_MESSAGES_COLLECTION_ID = process.env.APPWRITE_MESSAGES_COLLECTION_ID;
    
    console.log('🔍 Checking Appwrite Configuration...\n');
    
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
      console.error('❌ Missing Appwrite credentials');
      console.log('   Required: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
      process.exit(1);
    }
    
    if (!APPWRITE_DATABASE_ID) {
      console.error('❌ APPWRITE_DATABASE_ID is NOT SET!');
      console.log('\n💡 This is why messages are not saving.');
      console.log('   Add APPWRITE_DATABASE_ID to your .env file');
      console.log('   Get it from: Appwrite Console → Databases → Your Database → Settings');
      process.exit(1);
    }
    
    if (!APPWRITE_MESSAGES_COLLECTION_ID) {
      console.error('❌ APPWRITE_MESSAGES_COLLECTION_ID is NOT SET!');
      console.log('\n💡 Add APPWRITE_MESSAGES_COLLECTION_ID to your .env file');
      process.exit(1);
    }
    
    console.log('✅ All Appwrite env vars are set\n');
    
    const { Client, Databases } = require('node-appwrite');
    const client = new Client();
    client.setEndpoint(APPWRITE_ENDPOINT);
    client.setProject(APPWRITE_PROJECT_ID);
    client.setKey(APPWRITE_API_KEY);
    const databases = new Databases(client);
    
    console.log('🧪 Testing message save...\n');
    
    const testMessage = {
      sessionId: 'test_' + Date.now(),
      sender: 'user',
      text: 'Test message',
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({ test: true }),
      confidence: null
    };
    
    try {
      const result = await databases.createDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_MESSAGES_COLLECTION_ID,
        'unique()',
        testMessage
      );
      
      console.log('✅ Message saved successfully!');
      console.log(`   Document ID: ${result.$id}`);
      console.log(`   Session ID: ${result.sessionId}`);
      console.log(`   Text: ${result.text}\n`);
      
      // Clean up test message
      try {
        await databases.deleteDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_MESSAGES_COLLECTION_ID,
          result.$id
        );
        console.log('🧹 Test message cleaned up');
      } catch (cleanupErr) {
        console.warn('⚠️  Could not clean up test message:', cleanupErr?.message);
      }
      
      console.log('\n✅ Appwrite is configured correctly! Messages should save now.');
    } catch (err) {
      console.error('\n❌ Failed to save message:', err?.message || err);
      if (err.code === 404) {
        console.log('\n💡 Possible issues:');
        console.log('   1. Database ID is incorrect');
        console.log('   2. Collection ID is incorrect');
        console.log('   3. API key does not have write permissions');
        console.log('   4. Collection attributes are not set up correctly');
      } else if (err.code === 401) {
        console.log('\n💡 API key authentication failed');
        console.log('   Check your APPWRITE_API_KEY');
      } else if (err.code === 403) {
        console.log('\n💡 Permission denied');
        console.log('   Check API key permissions in Appwrite Console');
      }
      process.exit(1);
    }
    
  } catch (err) {
    console.error('\n❌ Error:', err?.message || err);
    process.exit(1);
  }
})();

