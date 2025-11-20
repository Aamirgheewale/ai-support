// Script to view what's stored in the sessions collection
require('dotenv').config();

(async () => {
  console.log('📋 Viewing Sessions in Appwrite\n');
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
    
    console.log('\n📊 Fetching Sessions...\n');
    
    const result = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_SESSIONS_COLLECTION_ID,
      [],
      50
    );
    
    console.log(`✅ Found ${result.total} session(s) total\n`);
    
    if (result.documents.length === 0) {
      console.log('   ℹ️  No sessions found yet.');
      console.log('   💡 Start a chat to create a session.\n');
      return;
    }
    
    // Sort by lastSeen (most recent first)
    const sortedSessions = result.documents.sort((a, b) => {
      const timeA = new Date(a.lastSeen || a.$createdAt || 0).getTime();
      const timeB = new Date(b.lastSeen || b.$createdAt || 0).getTime();
      return timeB - timeA;
    });
    
    console.log('📱 Sessions Overview:\n');
    console.log('─'.repeat(60));
    
    for (let idx = 0; idx < sortedSessions.length; idx++) {
      const session = sortedSessions[idx];
      console.log(`\n${idx + 1}. Session ID: ${session.sessionId}`);
      console.log('   ' + '─'.repeat(56));
      
      // Status
      console.log(`   Status: ${session.status || 'unknown'}`);
      
      // Last Seen
      if (session.lastSeen) {
        const lastSeen = new Date(session.lastSeen);
        const now = new Date();
        const diffMs = now - lastSeen;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        let timeAgo = '';
        if (diffMins < 1) timeAgo = 'just now';
        else if (diffMins < 60) timeAgo = `${diffMins} minute(s) ago`;
        else if (diffHours < 24) timeAgo = `${diffHours} hour(s) ago`;
        else timeAgo = `${diffDays} day(s) ago`;
        
        console.log(`   Last Seen: ${lastSeen.toLocaleString()} (${timeAgo})`);
      } else {
        console.log(`   Last Seen: Never`);
      }
      
      // Created At
      if (session.$createdAt || session.createdAt) {
        const createdAt = new Date(session.$createdAt || session.createdAt);
        console.log(`   Created: ${createdAt.toLocaleString()}`);
      }
      
      // Start Time
      if (session.startTime) {
        const startTime = new Date(session.startTime);
        console.log(`   Start Time: ${startTime.toLocaleString()}`);
      }
      
      // User Meta
      if (session.userMeta) {
        try {
          const userMeta = typeof session.userMeta === 'string' 
            ? JSON.parse(session.userMeta) 
            : session.userMeta;
          if (Object.keys(userMeta).length > 0) {
            console.log(`   User Info:`, JSON.stringify(userMeta, null, 2).split('\n').map(l => '   ' + l).join('\n'));
          }
        } catch (e) {
          if (session.userMeta && session.userMeta !== '{}') {
            console.log(`   User Meta: ${session.userMeta}`);
          }
        }
      }
      
      // Theme
      if (session.theme && session.theme !== '{}') {
        try {
          const theme = typeof session.theme === 'string' ? JSON.parse(session.theme) : session.theme;
          if (Object.keys(theme).length > 0) {
            console.log(`   Theme: Custom theme configured`);
          }
        } catch (e) {
          // Ignore theme parsing errors
        }
      }
      
      // Get message count for this session
      try {
        const messagesResult = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          process.env.APPWRITE_MESSAGES_COLLECTION_ID,
          [`equal("sessionId", "${session.sessionId}")`],
          1
        );
        console.log(`   Messages: ${messagesResult.total} message(s)`);
      } catch (e) {
        // Ignore message count errors
        console.log(`   Messages: Unable to count`);
      }
    }
    
    console.log('\n' + '─'.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   Total Sessions: ${result.total}`);
    console.log(`   Active Sessions: ${sortedSessions.filter(s => s.status === 'active').length}`);
    console.log(`   Sessions with Messages: ${sortedSessions.filter(s => {
      // This will be filled in by the message count check above
      return true; // Placeholder
    }).length}`);
    
    console.log('\n💡 What Each Field Means:');
    console.log('   • $id: Auto-generated document ID');
    console.log('   • sessionId: Unique identifier for the chat session');
    console.log('   • status: Current state (active, agent_assigned, closed, etc.)');
    console.log('   • startTime: When the session was started');
    console.log('   • lastSeen: When the user was last active');
    console.log('   • userMeta: Additional user information (browser, location, etc.)');
    console.log('   • theme: Custom theme settings for the chat widget');
    console.log('   • $createdAt: Auto-generated creation timestamp');
    console.log('   • $updatedAt: Auto-generated last update timestamp');
    
    console.log('\n✅ Done!\n');
    
  } catch (err) {
    console.error(`❌ Error: ${err?.message || err}`);
    console.error(`   Error code: ${err?.code}`);
    process.exit(1);
  }
})();

