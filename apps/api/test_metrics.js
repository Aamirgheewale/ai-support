require('dotenv').config();

const API_BASE = process.env.SERVER_URL || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-secret-change-me';

// Helper to format date
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Get date range (last 7 days)
const endDate = new Date();
const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

async function testMetrics() {
  console.log('🧪 Testing Analytics Metrics Endpoints');
  console.log('============================================================');
  console.log(`Server: ${API_BASE}`);
  console.log(`Date Range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
  console.log('');

  const headers = {
    'Authorization': `Bearer ${ADMIN_SECRET}`
  };

  // Test 1: Overview metrics
  console.log('📊 Test 1: Overview Metrics');
  try {
    const res = await fetch(`${API_BASE}/admin/metrics/overview?from=${formatDate(startDate)}&to=${formatDate(endDate)}`, { headers });
    const data = await res.json();
    
    if (!res.ok) {
      console.error(`❌ Failed: ${res.status} ${res.statusText}`);
      console.error(`   Response:`, data);
    } else {
      console.log(`✅ Status: ${res.status}`);
      console.log(`   Total Sessions: ${data.totalSessions}`);
      console.log(`   Total Messages: ${data.totalMessages}`);
      console.log(`   Avg Messages/Session: ${data.avgMessagesPerSession}`);
      console.log(`   Avg Bot Response Time: ${data.avgBotResponseTimeMs}ms`);
      console.log(`   Human Takeover Rate: ${data.humanTakeoverRate}%`);
      console.log(`   AI Fallback Count: ${data.aiFallbackCount}`);
      
      // Sanity checks
      if (typeof data.totalSessions !== 'number' || typeof data.totalMessages !== 'number') {
        console.error('   ⚠️  WARNING: Invalid data types');
      }
    }
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }

  console.log('');

  // Test 2: Messages over time
  console.log('📊 Test 2: Messages Over Time');
  try {
    const res = await fetch(`${API_BASE}/admin/metrics/messages-over-time?from=${formatDate(startDate)}&to=${formatDate(endDate)}&interval=day`, { headers });
    const data = await res.json();
    
    if (!res.ok) {
      console.error(`❌ Failed: ${res.status} ${res.statusText}`);
      console.error(`   Response:`, data);
    } else {
      console.log(`✅ Status: ${res.status}`);
      console.log(`   Data Points: ${data.length}`);
      if (data.length > 0) {
        console.log(`   First: ${data[0].date} - ${data[0].messages} messages, ${data[0].sessionsStarted} sessions`);
        console.log(`   Last: ${data[data.length - 1].date} - ${data[data.length - 1].messages} messages, ${data[data.length - 1].sessionsStarted} sessions`);
      }
      
      // Sanity check
      if (!Array.isArray(data)) {
        console.error('   ⚠️  WARNING: Expected array');
      }
    }
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }

  console.log('');

  // Test 3: Agent performance
  console.log('📊 Test 3: Agent Performance');
  try {
    const res = await fetch(`${API_BASE}/admin/metrics/agent-performance?from=${formatDate(startDate)}&to=${formatDate(endDate)}`, { headers });
    const data = await res.json();
    
    if (!res.ok) {
      console.error(`❌ Failed: ${res.status} ${res.statusText}`);
      console.error(`   Response:`, data);
    } else {
      console.log(`✅ Status: ${res.status}`);
      console.log(`   Agents: ${data.length}`);
      if (data.length > 0) {
        data.slice(0, 3).forEach((agent, i) => {
          console.log(`   ${i + 1}. ${agent.agentId}: ${agent.sessionsHandled} sessions, ${agent.messagesHandled} messages`);
        });
      }
      
      // Sanity check
      if (!Array.isArray(data)) {
        console.error('   ⚠️  WARNING: Expected array');
      }
    }
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }

  console.log('');

  // Test 4: Confidence histogram
  console.log('📊 Test 4: Confidence Histogram');
  try {
    const res = await fetch(`${API_BASE}/admin/metrics/confidence-histogram?from=${formatDate(startDate)}&to=${formatDate(endDate)}&bins=10`, { headers });
    const data = await res.json();
    
    if (!res.ok) {
      console.error(`❌ Failed: ${res.status} ${res.statusText}`);
      console.error(`   Response:`, data);
    } else {
      console.log(`✅ Status: ${res.status}`);
      console.log(`   Bins: ${data.length}`);
      if (data.length > 0) {
        const total = data.reduce((sum, bin) => sum + bin.count, 0);
        console.log(`   Total Messages: ${total}`);
        data.slice(0, 3).forEach((bin, i) => {
          console.log(`   ${i + 1}. ${bin.bin}: ${bin.count} messages`);
        });
      }
      
      // Sanity check
      if (!Array.isArray(data)) {
        console.error('   ⚠️  WARNING: Expected array');
      }
    }
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }

  console.log('');

  // Test 5: Response times
  console.log('📊 Test 5: Response Times');
  try {
    const res = await fetch(`${API_BASE}/admin/metrics/response-times?from=${formatDate(startDate)}&to=${formatDate(endDate)}&percentiles=50,90,99`, { headers });
    const data = await res.json();
    
    if (!res.ok) {
      console.error(`❌ Failed: ${res.status} ${res.statusText}`);
      console.error(`   Response:`, data);
    } else {
      console.log(`✅ Status: ${res.status}`);
      console.log(`   Count: ${data.count}`);
      console.log(`   Min: ${data.min}ms`);
      console.log(`   Max: ${data.max}ms`);
      console.log(`   Avg: ${data.avg}ms`);
      console.log(`   Percentiles:`);
      Object.entries(data.percentiles || {}).forEach(([p, value]) => {
        console.log(`     ${p}: ${value}ms`);
      });
      
      // Sanity check
      if (typeof data.count !== 'number') {
        console.error('   ⚠️  WARNING: Invalid data structure');
      }
    }
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }

  console.log('');

  // Test 6: Aggregate request (stub)
  console.log('📊 Test 6: Aggregate Request (Stub)');
  try {
    const res = await fetch(`${API_BASE}/admin/metrics/aggregate-request`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: formatDate(startDate),
        to: formatDate(endDate),
        metrics: ['overview', 'messages-over-time']
      })
    });
    const data = await res.json();
    
    if (!res.ok) {
      console.error(`❌ Failed: ${res.status} ${res.statusText}`);
      console.error(`   Response:`, data);
    } else {
      console.log(`✅ Status: ${res.status}`);
      console.log(`   Message: ${data.message}`);
      console.log(`   Job ID: ${data.jobId}`);
    }
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }

  console.log('');
  console.log('✅ All tests completed!');
}

// Use node-fetch if available, otherwise use built-in fetch (Node 18+)
if (typeof fetch === 'undefined') {
  const fetch = require('node-fetch');
  testMetrics();
} else {
  testMetrics();
}
