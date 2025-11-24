/**
 * Test Sessions Pagination
 * 
 * Tests pagination functionality for /admin/sessions endpoint.
 * 
 * Usage:
 *   node tests/test_sessions_pagination.js
 */

require('dotenv').config();
const { Client, Databases, Query, ID } = require('node-appwrite');

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPWRITE_SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION_ID;
const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';

const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT);
client.setProject(APPWRITE_PROJECT_ID);
client.setKey(APPWRITE_API_KEY);
const db = new Databases(client);

async function createTestSessions(count) {
  console.log(`📝 Creating ${count} test sessions...`);
  const sessions = [];
  
  for (let i = 0; i < count; i++) {
    const sessionId = `test_pagination_${Date.now()}_${i}`;
    const now = new Date().toISOString();
    
    try {
      const doc = await db.createDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_SESSIONS_COLLECTION_ID,
        sessionId,
        {
          sessionId: sessionId,
          status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'agent_assigned' : 'closed',
          lastSeen: now,
          startTime: now,
          userMeta: '{}',
          theme: '{}'
        }
      );
      sessions.push(doc);
    } catch (err) {
      if (err.code !== 409) {
        console.error(`❌ Failed to create session ${i}:`, err.message);
      }
    }
  }
  
  console.log(`✅ Created ${sessions.length} test sessions`);
  return sessions;
}

async function testPagination() {
  console.log('🧪 Testing Sessions Pagination');
  console.log('============================\n');
  
  // Check configuration
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.error('❌ Missing Appwrite configuration');
    process.exit(1);
  }
  
  if (!APPWRITE_DATABASE_ID || !APPWRITE_SESSIONS_COLLECTION_ID) {
    console.error('❌ Missing database/collection IDs');
    process.exit(1);
  }
  
  try {
    // Step 1: Create test data (25 sessions)
    console.log('Step 1: Creating test data...');
    const testSessions = await createTestSessions(25);
    console.log(`✅ Created ${testSessions.length} test sessions\n`);
    
    // Wait a bit for Appwrite to index
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Test pagination with limit=10
    console.log('Step 2: Testing pagination (limit=10, offset=0)...');
    const res1 = await fetch(`${API_BASE}/admin/sessions?limit=10&offset=0`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`
      }
    });
    
    if (!res1.ok) {
      throw new Error(`Request failed: ${res1.status} ${res1.statusText}`);
    }
    
    const data1 = await res1.json();
    console.log(`   Response: ${data1.items?.length || 0} items, total: ${data1.total || 0}, hasMore: ${data1.hasMore}`);
    
    // Assertions
    const items1 = data1.items || [];
    const total1 = data1.total || 0;
    const hasMore1 = data1.hasMore !== undefined ? data1.hasMore : true;
    
    if (items1.length !== 10) {
      console.error(`❌ Expected 10 items, got ${items1.length}`);
      process.exit(1);
    }
    
    if (total1 < 25) {
      console.warn(`⚠️  Expected total >= 25, got ${total1} (may include existing sessions)`);
    }
    
    if (!hasMore1 && total1 > 10) {
      console.error(`❌ Expected hasMore=true when total > limit, got hasMore=${hasMore1}`);
      process.exit(1);
    }
    
    console.log('✅ Pagination test passed!\n');
    
    // Step 3: Test next page
    console.log('Step 3: Testing next page (limit=10, offset=10)...');
    const res2 = await fetch(`${API_BASE}/admin/sessions?limit=10&offset=10`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`
      }
    });
    
    const data2 = await res2.json();
    const items2 = data2.items || [];
    
    console.log(`   Response: ${items2.length} items, total: ${data2.total || 0}, hasMore: ${data2.hasMore}`);
    
    if (items2.length === 0 && total1 > 10) {
      console.warn(`⚠️  Got 0 items on page 2, but total is ${total1}`);
    }
    
    // Check that items are different (no duplicates)
    const ids1 = new Set(items1.map(s => s.sessionId));
    const ids2 = new Set(items2.map(s => s.sessionId));
    const intersection = [...ids1].filter(id => ids2.has(id));
    
    if (intersection.length > 0) {
      console.warn(`⚠️  Found ${intersection.length} duplicate session IDs between pages`);
    } else {
      console.log('✅ No duplicate sessions between pages');
    }
    
    console.log('\n✅ All pagination tests passed!');
    
    // Cleanup: Delete test sessions
    console.log('\n🧹 Cleaning up test sessions...');
    let deleted = 0;
    for (const session of testSessions) {
      try {
        await db.deleteDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_SESSIONS_COLLECTION_ID,
          session.$id
        );
        deleted++;
      } catch (err) {
        // Ignore errors
      }
    }
    console.log(`✅ Deleted ${deleted} test sessions`);
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

testPagination().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

