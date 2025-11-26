/**
 * Test: Super Admin Signup with Role Allowed
 * Tests that super_admin can specify role during signup
 */

require('dotenv').config();
const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';

async function testSuperAdminSignupWithRole() {
  console.log('🧪 Testing Super Admin Signup with Role\n');

  const testEmail = `test_admin_${Date.now()}@example.com`;
  const testName = 'Test Admin User';

  try {
    // Signup with role and admin authorization
    console.log('1. Attempting signup with role (admin auth, no password)...');
    const signupRes = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_SECRET}` // Super admin token
      },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        role: 'admin' // Try to set admin role
      })
    });

    if (!signupRes.ok) {
      const error = await signupRes.json();
      throw new Error(`Signup failed: ${error.error || signupRes.statusText}`);
    }

    const signupData = await signupRes.json();
    console.log('✅ Signup successful:', signupData);

    // Verify role was accepted
    if (!signupData.roles || !signupData.roles.includes('admin')) {
      throw new Error(`Expected role 'admin', got: ${signupData.roles}`);
    }

    console.log('✅ Role was correctly set to "admin"\n');

    // Verify via login and /me
    console.log('2. Verifying via login (email-only)...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: testEmail
      })
    });

    if (!loginRes.ok) {
      const error = await loginRes.json();
      throw new Error(`Login failed: ${error.error || loginRes.statusText}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;

    const meRes = await fetch(`${API_BASE}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!meRes.ok) {
      throw new Error('/me failed');
    }

    const meData = await meRes.json();
    if (!meData.roles || !meData.roles.includes('admin')) {
      throw new Error(`Expected 'admin' role, got: ${meData.roles}`);
    }

    console.log('✅ Verified: User has "admin" role');
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

testSuperAdminSignupWithRole();

