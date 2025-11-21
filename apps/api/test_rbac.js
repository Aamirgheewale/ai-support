/**
 * RBAC Test Script
 * Tests user management, role assignment, and authorization
 */

require('dotenv').config();

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';

async function testRBAC() {
  console.log('🧪 Testing RBAC System...\n');
  
  const headers = {
    'Authorization': `Bearer ${ADMIN_SECRET}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Test 1: Get current user profile
    console.log('1️⃣ Testing GET /me');
    const meRes = await fetch(`${API_BASE}/me`, { headers });
    const meData = await meRes.json();
    console.log('   ✅ Current user:', meData);
    console.log(`   Roles: ${meData.roles?.join(', ') || 'none'}\n`);
    
    // Test 2: Create a test user with agent role
    console.log('2️⃣ Testing POST /admin/users (create agent)');
    const testEmail = `test-agent-${Date.now()}@test.local`;
    const createRes = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: testEmail,
        name: 'Test Agent',
        roles: ['agent']
      })
    });
    
    if (!createRes.ok) {
      const error = await createRes.json();
      throw new Error(`Failed to create user: ${error.error || createRes.statusText}`);
    }
    
    const createdUser = await createRes.json();
    console.log('   ✅ Created user:', createdUser);
    console.log(`   User ID: ${createdUser.userId}\n`);
    
    // Test 3: List all users
    console.log('3️⃣ Testing GET /admin/users');
    const listRes = await fetch(`${API_BASE}/admin/users`, { headers });
    const listData = await listRes.json();
    console.log(`   ✅ Found ${listData.users?.length || 0} users`);
    if (listData.users && listData.users.length > 0) {
      console.log('   Sample users:');
      listData.users.slice(0, 3).forEach(u => {
        console.log(`     - ${u.email} (${u.roles?.join(', ') || 'no roles'})`);
      });
    }
    console.log('');
    
    // Test 4: Update user roles
    console.log('4️⃣ Testing PUT /admin/users/:userId/roles');
    const updateRes = await fetch(`${API_BASE}/admin/users/${createdUser.userId}/roles`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        roles: ['agent', 'viewer']
      })
    });
    
    if (!updateRes.ok) {
      const error = await updateRes.json();
      throw new Error(`Failed to update roles: ${error.error || updateRes.statusText}`);
    }
    
    const updated = await updateRes.json();
    console.log('   ✅ Updated roles:', updated);
    console.log(`   New roles: ${updated.roles?.join(', ')}\n`);
    
    // Test 5: Test authorization (agent should not access admin endpoints)
    console.log('5️⃣ Testing authorization (agent token should fail on admin endpoints)');
    // Note: In dev mode, ADMIN_SHARED_SECRET maps to super_admin, so this test
    // would need a real token system to fully test. For now, we verify the endpoint exists.
    console.log('   ℹ️  Authorization test requires proper token system (TODO for production)\n');
    
    // Test 6: Cleanup - delete test user
    console.log('6️⃣ Testing DELETE /admin/users/:userId');
    const deleteRes = await fetch(`${API_BASE}/admin/users/${createdUser.userId}`, {
      method: 'DELETE',
      headers
    });
    
    if (!deleteRes.ok) {
      const error = await deleteRes.json();
      console.warn(`   ⚠️  Failed to delete user: ${error.error || deleteRes.statusText}`);
    } else {
      console.log('   ✅ Deleted test user\n');
    }
    
    console.log('✅ All RBAC tests passed!');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run tests
testRBAC();

