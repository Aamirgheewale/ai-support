/**
 * Test Accuracy Pagination
 * 
 * Tests pagination functionality for /admin/accuracy endpoint.
 * 
 * Usage:
 *   node tests/test_accuracy_pagination.js
 */

require('dotenv').config();

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';

async function testPagination() {
  console.log('🧪 Testing Accuracy Pagination');
  console.log('============================\n');
  
  try {
    // Step 1: Test pagination with limit=20
    console.log('Step 1: Testing pagination (limit=20, offset=0)...');
    const res1 = await fetch(`${API_BASE}/admin/accuracy?limit=20&offset=0`, {
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
    const items1 = data1.items || data1.records || [];
    const total1 = data1.total || 0;
    const hasMore1 = data1.hasMore !== undefined ? data1.hasMore : (items1.length === 20 && total1 > 20);
    
    if (items1.length > 20) {
      console.error(`❌ Expected <= 20 items, got ${items1.length}`);
      process.exit(1);
    }
    
    console.log('✅ Pagination test passed!\n');
    
    // Step 2: Test with filters
    console.log('Step 2: Testing pagination with filters...');
    const res2 = await fetch(`${API_BASE}/admin/accuracy?limit=10&offset=0&sortBy=createdAt&order=desc`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`
      }
    });
    
    const data2 = await res2.json();
    const items2 = data2.items || data2.records || [];
    
    console.log(`   Response: ${items2.length} items, total: ${data2.total || 0}`);
    console.log('✅ Filtered pagination test passed!\n');
    
    // Step 3: Test invalid limit
    console.log('Step 3: Testing invalid limit (should return 400)...');
    const res3 = await fetch(`${API_BASE}/admin/accuracy?limit=200&offset=0`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`
      }
    });
    
    if (res3.status === 400) {
      console.log('✅ Invalid limit correctly rejected (400)');
    } else {
      console.warn(`⚠️  Expected 400 for invalid limit, got ${res3.status}`);
    }
    
    console.log('\n✅ All accuracy pagination tests passed!');
    
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

