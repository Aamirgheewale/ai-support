// Diagnostic script to check Appwrite configuration and test message saving
require('dotenv').config();

(async () => {
  console.log('🔍 Appwrite Chat Storage Diagnostic Tool\n');
  console.log('=' .repeat(60));
  
  // Check environment variables
  console.log('\n📋 Step 1: Checking Environment Variables\n');
  
  const requiredVars = {
    'APPWRITE_ENDPOINT': process.env.APPWRITE_ENDPOINT,
    'APPWRITE_PROJECT_ID': process.env.APPWRITE_PROJECT_ID,
    'APPWRITE_API_KEY': process.env.APPWRITE_API_KEY,
    'APPWRITE_DATABASE_ID': process.env.APPWRITE_DATABASE_ID,
    'APPWRITE_SESSIONS_COLLECTION_ID': process.env.APPWRITE_SESSIONS_COLLECTION_ID,
    'APPWRITE_MESSAGES_COLLECTION_ID': process.env.APPWRITE_MESSAGES_COLLECTION_ID
  };
  
  let allSet = true;
  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      console.log(`✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`❌ ${key}: NOT SET`);
      allSet = false;
    }
  }
  
  if (!allSet) {
    console.log('\n⚠️  Missing required environment variables!');
    console.log('   Please check your .env file in apps/api/.env');
    console.log('   See ENV_TEMPLATE.md for reference');
    process.exit(1);
  }
  
  // Test Appwrite connection
  console.log('\n📋 Step 2: Testing Appwrite Connection\n');
  
  try {
    const { Client, Databases } = require('node-appwrite');
    const client = new Client();
    client.setEndpoint(process.env.APPWRITE_ENDPOINT);
    client.setProject(process.env.APPWRITE_PROJECT_ID);
    client.setKey(process.env.APPWRITE_API_KEY);
    const databases = new Databases(client);
    
    console.log('✅ Appwrite client created successfully');
    
    // Test database access
    console.log('\n📋 Step 3: Testing Database Access\n');
    
    try {
      const dbInfo = await databases.get(process.env.APPWRITE_DATABASE_ID);
      console.log(`✅ Database found: ${dbInfo.name || 'Unnamed'}`);
    } catch (err) {
      console.error(`❌ Cannot access database: ${err?.message || err}`);
      console.error(`   Error code: ${err?.code}`);
      if (err?.code === 404) {
        console.error('   💡 Database ID might be incorrect');
      } else if (err?.code === 401) {
        console.error('\n🔧 FIX REQUIRED: API Key Missing Scopes');
        console.error('   Your API key does not have the required permissions.');
        console.error('\n   Steps to fix:');
        console.error('   1. Go to Appwrite Console: https://cloud.appwrite.io');
        console.error('   2. Navigate to: Settings → API Keys');
        console.error('   3. Find your API key (or create a new one)');
        console.error('   4. Edit the API key and select these Scopes:');
        console.error('      ✅ databases.read');
        console.error('      ✅ databases.write');
        console.error('      ✅ collections.read');
        console.error('      ✅ collections.write');
        console.error('      ✅ documents.read');
        console.error('      ✅ documents.write');
        console.error('   5. Save the changes');
        console.error('   6. Update APPWRITE_API_KEY in your .env file if you created a new key');
        console.error('   7. Run this diagnostic again: node diagnose_appwrite.js');
        console.error('\n   ⚠️  Note: If you created a new API key, copy it immediately');
        console.error('      (you won\'t be able to see it again!)');
      } else if (err?.code === 403) {
        console.error('   💡 API key does not have read permissions');
      }
      process.exit(1);
    }
    
    // Test collections
    console.log('\n📋 Step 4: Testing Collections\n');
    
    // Test sessions collection
    try {
      const sessionsResult = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        process.env.APPWRITE_SESSIONS_COLLECTION_ID,
        [],
        1
      );
      console.log(`✅ Sessions collection accessible (${sessionsResult.total} documents)`);
    } catch (err) {
      console.error(`❌ Cannot access sessions collection: ${err?.message || err}`);
      console.error(`   Error code: ${err?.code}`);
      if (err?.code === 404) {
        console.error('   💡 Collection ID might be incorrect or collection does not exist');
        console.error('   💡 Create the collection in Appwrite Console');
      } else if (err?.code === 403) {
        console.error('   💡 API key does not have read permissions for this collection');
      }
    }
    
    // Test messages collection
    try {
      const messagesResult = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        process.env.APPWRITE_MESSAGES_COLLECTION_ID,
        [],
        1
      );
      console.log(`✅ Messages collection accessible (${messagesResult.total} documents)`);
    } catch (err) {
      console.error(`❌ Cannot access messages collection: ${err?.message || err}`);
      console.error(`   Error code: ${err?.code}`);
      if (err?.code === 404) {
        console.error('   💡 Collection ID might be incorrect or collection does not exist');
        console.error('   💡 Create the collection in Appwrite Console');
      } else if (err?.code === 403) {
        console.error('   💡 API key does not have read permissions for this collection');
      }
    }
    
    // Test message saving
    console.log('\n📋 Step 5: Testing Message Saving\n');
    
    const testSessionId = 'diagnostic_test_' + Date.now();
    const now = new Date().toISOString();
    // Try minimal required attributes first, then add optional ones
    const testMessage = {
      sessionId: testSessionId,
      sender: 'user',
      text: 'Diagnostic test message',
      createdAt: now,
      metadata: JSON.stringify({ diagnostic: true }),
      confidence: null
    };
    
    try {
      const result = await databases.createDocument(
        process.env.APPWRITE_DATABASE_ID,
        process.env.APPWRITE_MESSAGES_COLLECTION_ID,
        'unique()',
        testMessage
      );
      
      console.log('✅ Message saved successfully!');
      console.log(`   Document ID: ${result.$id}`);
      console.log(`   Session ID: ${result.sessionId}`);
      console.log(`   Text: ${result.text}`);
      
      // Clean up test message
      try {
        await databases.deleteDocument(
          process.env.APPWRITE_DATABASE_ID,
          process.env.APPWRITE_MESSAGES_COLLECTION_ID,
          result.$id
        );
        console.log('🧹 Test message cleaned up');
      } catch (cleanupErr) {
        console.warn('⚠️  Could not clean up test message:', cleanupErr?.message);
      }
      
      console.log('\n✅ All tests passed! Chat messages should save correctly.');
      console.log('\n💡 If messages still don\'t save:');
      console.log('   1. Restart your server after fixing any issues');
      console.log('   2. Check server logs for error messages');
      console.log('   3. Verify collection attributes match required schema');
      
    } catch (err) {
      console.error(`❌ Failed to save test message: ${err?.message || err}`);
      console.error(`   Error code: ${err?.code}`);
      
      if (err?.code === 400) {
        console.error('\n💡 Bad request - Collection attributes don\'t match');
        console.error(`   Error: ${err?.message || 'Unknown attribute error'}`);
        console.error('\n   🔧 Fix: Check your messages collection attributes in Appwrite Console');
        console.error('      1. Go to: Databases → Your Database → messages → Attributes');
        console.error('      2. Check each attribute TYPE (not just name):');
        console.error('         ✅ sessionId → String (not email, not integer)');
        console.error('         ✅ sender → String (not email, not integer)');
        console.error('         ✅ text → String (not email! This is the problem!)');
        console.error('         ✅ createdAt → DateTime');
        console.error('         ✅ metadata → String (optional)');
        console.error('         ✅ confidence → Double/Float (optional)');
        console.error('\n   ⚠️  COMMON ISSUE: If "text" is set as Email type, delete it and recreate as String');
        console.error('      The "text" attribute must be String type, not Email type!');
        console.error('\n   💡 Steps to fix "text" attribute:');
        console.error('      1. Go to messages → Attributes');
        console.error('      2. Find "text" attribute');
        console.error('      3. If type is "Email", click Delete');
        console.error('      4. Create new attribute: Name="text", Type="String", Size=10000, Required=Yes');
      } else if (err?.code === 403) {
        console.error('\n💡 Permission denied - API key needs write access');
        console.error('   Go to Appwrite Console → Settings → API Keys');
        console.error('   Edit your API key and ensure it has write permissions');
      }
      
      process.exit(1);
    }
    
  } catch (err) {
    console.error(`❌ Failed to initialize Appwrite client: ${err?.message || err}`);
    console.error('   Make sure node-appwrite is installed: pnpm add node-appwrite');
    process.exit(1);
  }
})();

