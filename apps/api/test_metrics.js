// Test script for metrics endpoints
require('dotenv').config();

// Use node-fetch for Node.js < 18 compatibility
let fetch;
try {
  fetch = globalThis.fetch || require('node-fetch');
} catch (e) {
  console.error('❌ fetch not available. Install node-fetch: pnpm add node-fetch@2');
  process.exit(1);
}

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';

async function testMetrics() {
  console.log('🧪 Testing Metrics Endpoints\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Admin Secret: ${ADMIN_SECRET.substring(0, 10)}...\n`);

  const headers = {
    'Authorization': `Bearer ${ADMIN_SECRET}`,
    'Content-Type': 'application/json'
  };

  // Calculate date range (last 7 days)
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fromISO = from.toISOString().split('T')[0];
  const toISO = to.toISOString().split('T')[0];

  console.log(`📅 Date Range: ${fromISO} to ${toISO}\n`);

  const tests = [
    {
      name: 'Overview Metrics',
      url: `${API_BASE}/admin/metrics/overview?from=${fromISO}&to=${toISO}`,
      assertions: (data) => {
        if (typeof data.totalSessions !== 'number' || data.totalSessions < 0) {
          throw new Error('totalSessions must be a non-negative number');
        }
        if (typeof data.totalMessages !== 'number' || data.totalMessages < 0) {
          throw new Error('totalMessages must be a non-negative number');
        }
        if (typeof data.avgMessagesPerSession !== 'number') {
          throw new Error('avgMessagesPerSession must be a number');
        }
        if (typeof data.avgResponseTimeMs !== 'number' || data.avgResponseTimeMs < 0) {
          throw new Error('avgResponseTimeMs must be a non-negative number');
        }
        if (typeof data.humanTakeoverRate !== 'number' || data.humanTakeoverRate < 0 || data.humanTakeoverRate > 100) {
          throw new Error('humanTakeoverRate must be between 0 and 100');
        }
        if (typeof data.aiFallbackCount !== 'number' || data.aiFallbackCount < 0) {
          throw new Error('aiFallbackCount must be a non-negative number');
        }
      }
    },
    {
      name: 'Messages Over Time',
      url: `${API_BASE}/admin/metrics/messages-over-time?from=${fromISO}&to=${toISO}&interval=day`,
      assertions: (data) => {
        if (!Array.isArray(data.timeseries)) {
          throw new Error('timeseries must be an array');
        }
        data.timeseries.forEach((item, idx) => {
          if (!item.date || typeof item.messages !== 'number' || typeof item.sessionsStarted !== 'number') {
            throw new Error(`Invalid timeseries item at index ${idx}`);
          }
        });
      }
    },
    {
      name: 'Confidence Histogram',
      url: `${API_BASE}/admin/metrics/confidence-histogram?from=${fromISO}&to=${toISO}&bins=10`,
      assertions: (data) => {
        if (!Array.isArray(data.histogram)) {
          throw new Error('histogram must be an array');
        }
        if (typeof data.totalMessages !== 'number' || data.totalMessages < 0) {
          throw new Error('totalMessages must be a non-negative number');
        }
        if (data.histogram.length !== 10) {
          throw new Error(`Expected 10 bins, got ${data.histogram.length}`);
        }
      }
    },
    {
      name: 'Response Times',
      url: `${API_BASE}/admin/metrics/response-times?from=${fromISO}&to=${toISO}&percentiles=50,90,99`,
      assertions: (data) => {
        if (typeof data.percentiles !== 'object' || data.percentiles === null) {
          throw new Error('percentiles must be an object');
        }
        if (!Array.isArray(data.distribution)) {
          throw new Error('distribution must be an array');
        }
        if (typeof data.totalResponses !== 'number' || data.totalResponses < 0) {
          throw new Error('totalResponses must be a non-negative number');
        }
        if (typeof data.avgResponseTime !== 'number' || data.avgResponseTime < 0) {
          throw new Error('avgResponseTime must be a non-negative number');
        }
        // Check percentiles
        const expectedPercentiles = [50, 90, 99];
        expectedPercentiles.forEach(p => {
          if (typeof data.percentiles[p] !== 'number' || data.percentiles[p] < 0) {
            throw new Error(`Percentile ${p} must be a non-negative number`);
          }
        });
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n📊 Testing: ${test.name}`);
      console.log(`   URL: ${test.url}`);
      
      const response = await fetch(test.url, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      // Run assertions
      test.assertions(data);
      
      console.log(`   ✅ PASSED`);
      console.log(`   Response:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
      passed++;
    } catch (err) {
      console.error(`   ❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n\n📋 Test Summary:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Total: ${tests.length}`);

  if (failed === 0) {
    console.log(`\n🎉 All tests passed!`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Some tests failed. Check the output above.`);
    process.exit(1);
  }
}

// Run tests
testMetrics().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});

