require('dotenv').config();
const { Client, Databases } = require('node-appwrite');

(async () => {
  const client = new Client();
  client.setEndpoint(process.env.APPWRITE_ENDPOINT);
  client.setProject(process.env.APPWRITE_PROJECT_ID);
  client.setKey(process.env.APPWRITE_API_KEY);
  const db = new Databases(client);
  
  console.log('Checking actual dates in database...\n');
  
  const msgs = await db.listDocuments(
    process.env.APPWRITE_DATABASE_ID,
    process.env.APPWRITE_MESSAGES_COLLECTION_ID,
    [],
    10
  );
  
  console.log('Sample message dates:');
  msgs.documents.forEach(m => {
    const date = m.$createdAt || m.createdAt || m.timestamp;
    console.log(`  - ${date} | session: ${m.sessionId}`);
  });
  
  const sessions = await db.listDocuments(
    process.env.APPWRITE_DATABASE_ID,
    process.env.APPWRITE_SESSIONS_COLLECTION_ID,
    [],
    10
  );
  
  console.log('\nSample session dates:');
  sessions.documents.forEach(s => {
    const date = s.$createdAt || s.createdAt || s.lastSeen;
    console.log(`  - ${date} | session: ${s.sessionId}`);
  });
  
  console.log(`\nCurrent date: ${new Date().toISOString()}`);
  console.log(`Query range: 2025-11-13 to 2025-11-20`);
  console.log(`\n⚠️  If your data is from 2024, the query won't find it!`);
})();

