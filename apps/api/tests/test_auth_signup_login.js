/**
 * Test: Signup and Login Flow
 * Tests basic signup (no role), login, and /me endpoint
 */

require('dotenv').config();
const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SHARED_SECRET || 'dev-secret-change-me';

async function testSignupLogin() {
  console.log('🧪 Testing Signup and Login Flow\n');

  const testEmail = `test_${Date.now()}@example.com`;
  const testName = 'Test User';

  try {
    // 1. Test Signup (no role - should default to viewer)
    console.log('1. Testing signup (no role, no password)...');
    const signupRes = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: testName,
        email: testEmail
      })
    });

    if (!signupRes.ok) {
      const error = await signupRes.json();
      throw new Error(`Signup failed: ${error.error || signupRes.statusText}`);
    }

    const signupData = await signupRes.json();
    console.log('✅ Signup successful:', signupData);
    
    if (signupData.roles && !signupData.roles.includes('viewer')) {
      throw new Error(`Expected default role 'viewer', got: ${signupData.roles}`);
    }
    console.log('✅ Default role is "viewer"\n');

    // 2. Test Login (email-only, no password)
    console.log('2. Testing login (email-only)...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        email: testEmail,
        remember: false
      })
    });

    if (!loginRes.ok) {
      const error = await loginRes.json();
      throw new Error(`Login failed: ${error.error || loginRes.statusText}`);
    }

    const loginData = await loginRes.json();
    console.log('✅ Login successful:', { ok: loginData.ok, hasToken: !!loginData.token });
    
    if (!loginData.ok || !loginData.token) {
      throw new Error('Login response missing ok or token');
    }

    // Extract cookies if any
    const cookies = loginRes.headers.get('set-cookie');
    if (cookies) {
      console.log('✅ Cookie set:', cookies.substring(0, 50) + '...');
    }

    // 3. Test /me endpoint
    console.log('\n3. Testing /me endpoint...');
    const token = loginData.token || ADMIN_SECRET;
    const meRes = await fetch(`${API_BASE}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });

    if (!meRes.ok) {
      const error = await meRes.json();
      throw new Error(`/me failed: ${error.error || meRes.statusText}`);
    }

    const meData = await meRes.json();
    console.log('✅ /me successful:', {
      userId: meData.userId,
      email: meData.email,
      name: meData.name,
      roles: meData.roles,
      hasCreatedAt: !!meData.createdAt,
      hasLastSeen: !!meData.lastSeen
    });

    if (meData.email !== testEmail) {
      throw new Error(`Expected email ${testEmail}, got ${meData.email}`);
    }

    if (!meData.roles || !meData.roles.includes('viewer')) {
      throw new Error(`Expected role 'viewer', got: ${meData.roles}`);
    }

    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

testSignupLogin();

