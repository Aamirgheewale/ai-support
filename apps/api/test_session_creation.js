// Quick test to verify session creation works with your schema
require('dotenv').config();

(async () => {
  console.log('🧪 Testing Session Creation\n');
  console.log('='.repeat(60));
  
  const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
  const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
  const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
  const APPWRITE_SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION_ID;
  
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || 
      !APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }
  
  try {
    const { Client, Databases } = require('node-appwrite');
    const client = new Client();
    client.setEndpoint(APPWRITE_ENDPOINT);
    client.setProject(APPWRITE_PROJECT_ID);
    client.setKey(APPWRITE_API_KEY);
    const databases = new Databases(client);
    
    const testSessionId = 'test_' + Date.now();
    const now = new Date().toISOString();
    
    console.log('\n📝 Creating test session...');
    console.log(`   Session ID: ${testSessionId}`);
    
    const sessionDoc = {
      sessionId: testSessionId,
      status: 'active',
      lastSeen: now,
      startTime: now,
      userMeta: JSON.stringify({ test: true }),
      theme: '{}'
    };
    
    try {
      const result = await databases.createDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        testSessionId,
        sessionDoc
      );
      
      console.log('\n✅ Session created successfully!');
      console.log(`   Document ID: ${result.$id}`);
      console.log(`   Session ID: ${result.sessionId}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Start Time: ${result.startTime}`);
      console.log(`   Last Seen: ${result.lastSeen}`);
      console.log(`   Created At: ${result.$createdAt}`);
      
      // Clean up test session
      console.log('\n🧹 Cleaning up test session...');
      try {
        await databases.deleteDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_SESSIONS_COLLECTION_ID,
          testSessionId
        );
        console.log('✅ Test session deleted');
      } catch (cleanupErr) {
        console.warn('⚠️  Could not delete test session:', cleanupErr?.message);
      }
      
      console.log('\n✅ Session creation works correctly!');
      console.log('💡 Your server should now create sessions when users chat.\n');
      
    } catch (err) {
      console.error('\n❌ Failed to create session:', err?.message || err);
      console.error(`   Error code: ${err?.code}`);
      
      if (err?.code === 400) {
        console.error('\n💡 Bad request - Check collection attributes:');
        console.error('   Required: sessionId, status, lastSeen, startTime, userMeta, theme');
      } else if (err?.code === 401) {
        console.error('\n💡 Authentication failed - Check API key scopes');
      } else if (err?.code === 403) {
        console.error('\n💡 Permission denied - Check API key permissions');
      }
      
      process.exit(1);
    }
    
  } catch (err) {
    console.error(`❌ Error: ${err?.message || err}`);
    process.exit(1);
  }
})();

