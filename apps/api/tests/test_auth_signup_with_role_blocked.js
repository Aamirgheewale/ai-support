/**
 * Test: Signup with Role Blocked
 * Tests that signup with role is ignored when not authorized
 */

require('dotenv').config();
const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:4000';

async function testSignupWithRoleBlocked() {
  console.log('🧪 Testing Signup with Role (Blocked)\n');

  const testEmail = `test_blocked_${Date.now()}@example.com`;
  const testName = 'Test User Blocked';

  try {
    // Attempt signup with role but without admin authorization
    console.log('1. Attempting signup with role (no admin auth, no password)...');
    const signupRes = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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

    // Verify role was ignored and defaulted to viewer
    if (signupData.roles && signupData.roles.includes('admin')) {
      throw new Error(`Role should be ignored, but got: ${signupData.roles}`);
    }

    if (!signupData.roles || !signupData.roles.includes('viewer')) {
      throw new Error(`Expected default role 'viewer', got: ${signupData.roles}`);
    }

    console.log('✅ Role was correctly ignored, defaulted to "viewer"\n');

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
    if (!meData.roles || !meData.roles.includes('viewer') || meData.roles.includes('admin')) {
      throw new Error(`Expected only 'viewer' role, got: ${meData.roles}`);
    }

    console.log('✅ Verified: User has only "viewer" role');
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

testSignupWithRoleBlocked();

