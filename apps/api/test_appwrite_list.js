// apps/api/test_appwrite_list.js — Test Appwrite session/message listing
require('dotenv').config();

(async () => {
  try {
    const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
    const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
    const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
    const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
    const APPWRITE_SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION_ID;
    const APPWRITE_MESSAGES_COLLECTION_ID = process.env.APPWRITE_MESSAGES_COLLECTION_ID;
    
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
      console.error('❌ Appwrite env vars missing');
      console.log('   Required: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
      process.exit(1);
    }
    
    const { Client, Databases } = require('node-appwrite');
    
    const client = new Client();
    client.setEndpoint(APPWRITE_ENDPOINT);
    client.setProject(APPWRITE_PROJECT_ID);
    client.setKey(APPWRITE_API_KEY);
    
    const databases = new Databases(client);
    
    console.log('📋 Listing sessions...\n');
    
    if (APPWRITE_DATABASE_ID && APPWRITE_SESSIONS_COLLECTION_ID) {
      const sessions = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        [],
        10
      );
      
      console.log(`Found ${sessions.total} session(s):`);
      sessions.documents.forEach(session => {
        console.log(`  - ${session.sessionId} (status: ${session.status}, lastSeen: ${session.lastSeen})`);
      });
    } else {
      console.log('⚠️  APPWRITE_DATABASE_ID or APPWRITE_SESSIONS_COLLECTION_ID not set');
    }
    
    console.log('\n📨 Listing messages...\n');
    
    if (APPWRITE_DATABASE_ID && APPWRITE_MESSAGES_COLLECTION_ID) {
      const messages = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_MESSAGES_COLLECTION_ID,
        [],
        10
      );
      
      console.log(`Found ${messages.total} message(s):`);
      messages.documents.forEach(msg => {
        console.log(`  - [${msg.sender}] ${msg.text?.substring(0, 50)}... (session: ${msg.sessionId})`);
      });
    } else {
      console.log('⚠️  APPWRITE_DATABASE_ID or APPWRITE_MESSAGES_COLLECTION_ID not set');
    }
    
    console.log('\n✅ Test completed successfully!');
  } catch (err) {
    console.error('\n❌ Error:', err?.message || err);
    if (err.code) console.error('   Code:', err.code);
    if (err.response) console.error('   Response:', JSON.stringify(err.response, null, 2).substring(0, 500));
    process.exit(1);
  }
})();
