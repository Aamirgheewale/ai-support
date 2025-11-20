// Script to verify that chats are actually being stored in Appwrite
require('dotenv').config();

(async () => {
  console.log('🔍 Verifying Chat Storage in Appwrite\n');
  console.log('='.repeat(60));
  
  const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
  const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
  const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
  const APPWRITE_SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION_ID;
  const APPWRITE_MESSAGES_COLLECTION_ID = process.env.APPWRITE_MESSAGES_COLLECTION_ID;
  
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || 
      !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
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
    
    console.log('\n📋 Step 1: Checking Sessions\n');
    try {
      const sessionsResult = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        [],
        10
      );
      
      console.log(`✅ Found ${sessionsResult.total} session(s)`);
      if (sessionsResult.documents.length > 0) {
        console.log('\n   Recent Sessions:');
        sessionsResult.documents.forEach((session, idx) => {
          const lastSeen = session.lastSeen ? new Date(session.lastSeen).toLocaleString() : 'Never';
          console.log(`   ${idx + 1}. Session: ${session.sessionId}`);
          console.log(`      Status: ${session.status || 'unknown'}`);
          console.log(`      Last Seen: ${lastSeen}`);
          console.log(`      Needs Human: ${session.needsHuman ? 'Yes' : 'No'}`);
          console.log('');
        });
      } else {
        console.log('   ℹ️  No sessions found yet. Start a chat to create one.');
      }
    } catch (err) {
      console.error(`❌ Error loading sessions: ${err?.message || err}`);
    }
    
    console.log('\n📋 Step 2: Checking Messages\n');
    try {
      const messagesResult = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_MESSAGES_COLLECTION_ID,
        [],
        20
      );
      
      console.log(`✅ Found ${messagesResult.total} message(s) total`);
      
      if (messagesResult.documents.length > 0) {
        console.log('\n   Recent Messages (last 20):');
        console.log('   ' + '-'.repeat(58));
        
        // Sort by timestamp
        const sortedMessages = messagesResult.documents.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return timeA - timeB;
        });
        
        sortedMessages.forEach((msg, idx) => {
          const time = new Date(msg.createdAt || msg.timestamp || msg.$createdAt).toLocaleString();
          const sender = msg.sender === 'user' ? '👤 User' : msg.sender === 'bot' ? '🤖 Bot' : `👨‍💼 ${msg.sender}`;
          const textPreview = msg.text.length > 50 ? msg.text.substring(0, 50) + '...' : msg.text;
          
          console.log(`   ${idx + 1}. [${time}] ${sender}`);
          console.log(`      "${textPreview}"`);
          console.log(`      Session: ${msg.sessionId}`);
          if (msg.confidence !== null && msg.confidence !== undefined) {
            console.log(`      Confidence: ${msg.confidence}`);
          }
          console.log('');
        });
        
        // Group by session
        const bySession = {};
        sortedMessages.forEach(msg => {
          if (!bySession[msg.sessionId]) {
            bySession[msg.sessionId] = [];
          }
          bySession[msg.sessionId].push(msg);
        });
        
        console.log('\n   Messages by Session:');
        Object.keys(bySession).forEach(sessionId => {
          console.log(`   📱 Session: ${sessionId} (${bySession[sessionId].length} messages)`);
        });
        
      } else {
        console.log('\n   ⚠️  No messages found in Appwrite yet.');
        console.log('   💡 To test:');
        console.log('      1. Start your server: node index.js');
        console.log('      2. Open your chat widget in a browser');
        console.log('      3. Send a test message');
        console.log('      4. Run this script again to verify it was saved');
      }
    } catch (err) {
      console.error(`❌ Error loading messages: ${err?.message || err}`);
      console.error(`   Error code: ${err?.code}`);
    }
    
    console.log('\n📋 Step 3: Real-time Test\n');
    console.log('   To verify messages are saving in real-time:');
    console.log('   1. Keep this script running');
    console.log('   2. Send a message through your chat widget');
    console.log('   3. Run this script again to see the new message');
    console.log('   Or use: watch -n 2 node verify_chats_stored.js (Linux/Mac)');
    
    console.log('\n✅ Verification Complete!\n');
    
  } catch (err) {
    console.error(`❌ Error: ${err?.message || err}`);
    process.exit(1);
  }
})();

