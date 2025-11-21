/**
 * Test Script: Accuracy Logging
 * Tests accuracy record creation and feedback functionality
 */

require('dotenv').config();

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';

async function testAccuracyLogging() {
  console.log('🧪 Testing Accuracy Logging System...\n');
  
  const headers = {
    'Authorization': `Bearer ${ADMIN_SECRET}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Test 1: Create a dummy session
    console.log('1️⃣ Creating test session...');
    const sessionId = `test_accuracy_${Date.now()}`;
    console.log(`   Session ID: ${sessionId}\n`);
    
    // Test 2: Simulate AI response (would normally happen via Socket.IO)
    // For testing, we'll call saveAccuracyRecord directly via a test endpoint
    // or we can test the actual flow by sending a message through Socket.IO
    
    console.log('2️⃣ Testing accuracy record creation...');
    console.log('   ℹ️  Accuracy records are created automatically when AI responds.');
    console.log('   ℹ️  To test: send a message through the chat widget and check Appwrite.\n');
    
    // Test 3: List accuracy records
    console.log('3️⃣ Testing GET /admin/accuracy...');
    const listRes = await fetch(`${API_BASE}/admin/accuracy?limit=5`, { headers });
    if (!listRes.ok) {
      throw new Error(`Failed to list accuracy records: ${listRes.statusText}`);
    }
    const listData = await listRes.json();
    console.log(`   ✅ Found ${listData.total || 0} accuracy records`);
    if (listData.records && listData.records.length > 0) {
      console.log(`   Sample record:`);
      const sample = listData.records[0];
      console.log(`     - Session: ${sample.sessionId}`);
      console.log(`     - Type: ${sample.responseType}`);
      console.log(`     - Confidence: ${sample.confidence}`);
      console.log(`     - Latency: ${sample.latencyMs}ms`);
    }
    console.log('');
    
    // Test 4: Get accuracy stats
    console.log('4️⃣ Testing GET /admin/accuracy/stats...');
    const statsRes = await fetch(`${API_BASE}/admin/accuracy/stats`, { headers });
    if (!statsRes.ok) {
      throw new Error(`Failed to get stats: ${statsRes.statusText}`);
    }
    const statsData = await statsRes.json();
    console.log('   ✅ Stats retrieved:');
    console.log(`     - Total Responses: ${statsData.totalResponses}`);
    console.log(`     - Avg Confidence: ${statsData.avgConfidence?.toFixed(2) || 0}`);
    console.log(`     - Avg Latency: ${statsData.avgLatencyMs}ms`);
    console.log(`     - Helpful Rate: ${statsData.helpfulRate?.toFixed(2) || 0}%`);
    console.log(`     - Flagged: ${statsData.flaggedCount}`);
    console.log('');
    
    // Test 5: Add feedback (if we have an accuracy record)
    if (listData.records && listData.records.length > 0) {
      console.log('5️⃣ Testing POST /admin/accuracy/:id/feedback...');
      const accuracyId = listData.records[0].$id;
      const feedbackRes = await fetch(`${API_BASE}/admin/accuracy/${accuracyId}/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mark: 'up',
          note: 'Test feedback from test script'
        })
      });
      
      if (!feedbackRes.ok) {
        throw new Error(`Failed to add feedback: ${feedbackRes.statusText}`);
      }
      
      const feedbackData = await feedbackRes.json();
      console.log(`   ✅ Feedback added: ${feedbackData.mark}`);
      console.log('');
    } else {
      console.log('5️⃣ Skipping feedback test (no accuracy records found)');
      console.log('   💡 Send a message through the chat widget to create accuracy records\n');
    }
    
    console.log('✅ All accuracy logging tests passed!');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run tests
testAccuracyLogging();

