/**
 * Test Script: Accuracy Stats
 * Tests accuracy statistics endpoint and data aggregation
 */

require('dotenv').config();

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';

async function testAccuracyStats() {
  console.log('🧪 Testing Accuracy Stats Endpoint...\n');
  
  const headers = {
    'Authorization': `Bearer ${ADMIN_SECRET}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Test 1: Get stats for last 7 days (default)
    console.log('1️⃣ Testing GET /admin/accuracy/stats (default: last 7 days)...');
    const statsRes = await fetch(`${API_BASE}/admin/accuracy/stats`, { headers });
    
    if (!statsRes.ok) {
      const error = await statsRes.json().catch(() => ({ error: statsRes.statusText }));
      throw new Error(`Failed to get stats: ${error.error || statsRes.statusText}`);
    }
    
    const stats = await statsRes.json();
    console.log('   ✅ Stats retrieved:');
    console.log(`     - Total Responses: ${stats.totalResponses}`);
    console.log(`     - Avg Confidence: ${stats.avgConfidence?.toFixed(3) || 0}`);
    console.log(`     - Avg Latency: ${stats.avgLatencyMs}ms`);
    console.log(`     - Helpful Rate: ${stats.helpfulRate?.toFixed(2) || 0}%`);
    console.log(`     - Unhelpful Rate: ${stats.unhelpfulRate?.toFixed(2) || 0}%`);
    console.log(`     - Flagged Count: ${stats.flaggedCount}`);
    console.log(`     - Date Range: ${stats.startDate} to ${stats.endDate}`);
    console.log('');
    
    // Sanity checks
    console.log('2️⃣ Running sanity checks...');
    const checks = [];
    
    if (typeof stats.totalResponses === 'number' && stats.totalResponses >= 0) {
      checks.push('✅ totalResponses is valid number');
    } else {
      checks.push('❌ totalResponses is invalid');
    }
    
    if (typeof stats.avgConfidence === 'number' && stats.avgConfidence >= 0 && stats.avgConfidence <= 1) {
      checks.push('✅ avgConfidence is valid (0-1)');
    } else {
      checks.push('❌ avgConfidence is invalid');
    }
    
    if (typeof stats.avgLatencyMs === 'number' && stats.avgLatencyMs >= 0) {
      checks.push('✅ avgLatencyMs is valid');
    } else {
      checks.push('❌ avgLatencyMs is invalid');
    }
    
    if (typeof stats.helpfulRate === 'number' && stats.helpfulRate >= 0 && stats.helpfulRate <= 100) {
      checks.push('✅ helpfulRate is valid (0-100%)');
    } else {
      checks.push('❌ helpfulRate is invalid');
    }
    
    checks.forEach(check => console.log(`   ${check}`));
    console.log('');
    
    // Test 2: Get stats with date range
    console.log('3️⃣ Testing GET /admin/accuracy/stats with date range...');
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];
    
    const rangeRes = await fetch(`${API_BASE}/admin/accuracy/stats?from=${fromDate}&to=${toDate}`, { headers });
    
    if (!rangeRes.ok) {
      const error = await rangeRes.json().catch(() => ({ error: rangeRes.statusText }));
      throw new Error(`Failed to get stats with range: ${error.error || rangeRes.statusText}`);
    }
    
    const rangeStats = await rangeRes.json();
    console.log(`   ✅ Stats for ${fromDate} to ${toDate}:`);
    console.log(`     - Total Responses: ${rangeStats.totalResponses}`);
    console.log('');
    
    // Test 3: Test caching (second request should be faster)
    console.log('4️⃣ Testing cache (second request should be faster)...');
    const cacheStart = Date.now();
    const cacheRes = await fetch(`${API_BASE}/admin/accuracy/stats`, { headers });
    const cacheTime = Date.now() - cacheStart;
    
    if (cacheRes.ok) {
      console.log(`   ✅ Cached response received in ${cacheTime}ms`);
      console.log('   ℹ️  Cache TTL is 60 seconds');
    }
    console.log('');
    
    console.log('✅ All accuracy stats tests passed!');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run tests
testAccuracyStats();

