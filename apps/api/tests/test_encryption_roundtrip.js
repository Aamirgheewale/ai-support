/**
 * Encryption Roundtrip Test
 * 
 * Tests that encryption and decryption work correctly end-to-end.
 * 
 * Usage:
 *   node tests/test_encryption_roundtrip.js
 * 
 * Environment:
 *   MASTER_KEY_BASE64 - Required (32 bytes base64-encoded)
 */

require('dotenv').config();
const { encryptPayload, decryptPayload, formatForStorage, parseFromStorage, redactPII } = require('../lib/encryption');

const MASTER_KEY_BASE64 = process.env.MASTER_KEY_BASE64;

if (!MASTER_KEY_BASE64) {
  console.error('❌ MASTER_KEY_BASE64 environment variable is required');
  console.error('   Generate a key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  process.exit(1);
}

// Validate key length
const keyBuffer = Buffer.from(MASTER_KEY_BASE64, 'base64');
if (keyBuffer.length !== 32) {
  console.error(`❌ MASTER_KEY_BASE64 must decode to 32 bytes (got ${keyBuffer.length})`);
  process.exit(1);
}

console.log('🧪 Encryption Roundtrip Test');
console.log('===========================\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    testsFailed++;
  }
}

// Test 1: Basic encrypt/decrypt
test('Basic encrypt/decrypt', () => {
  const plaintext = 'Hello, this is a test message!';
  const encrypted = encryptPayload(plaintext, MASTER_KEY_BASE64);
  const decrypted = decryptPayload(encrypted, MASTER_KEY_BASE64);
  
  if (decrypted !== plaintext) {
    throw new Error(`Decrypted text doesn't match: expected "${plaintext}", got "${decrypted}"`);
  }
});

// Test 2: Storage format roundtrip
test('Storage format roundtrip', () => {
  const plaintext = 'Test message for storage format';
  const encrypted = encryptPayload(plaintext, MASTER_KEY_BASE64);
  const storageFormat = formatForStorage(encrypted);
  const parsed = parseFromStorage(storageFormat);
  const decrypted = decryptPayload(parsed, MASTER_KEY_BASE64);
  
  if (decrypted !== plaintext) {
    throw new Error(`Storage format roundtrip failed`);
  }
});

// Test 3: Different plaintexts produce different ciphertexts
test('Different plaintexts produce different ciphertexts', () => {
  const plaintext1 = 'Message 1';
  const plaintext2 = 'Message 2';
  
  const encrypted1 = encryptPayload(plaintext1, MASTER_KEY_BASE64);
  const encrypted2 = encryptPayload(plaintext2, MASTER_KEY_BASE64);
  
  if (encrypted1.ciphertextBase64 === encrypted2.ciphertextBase64) {
    throw new Error('Same ciphertext for different plaintexts (should be different)');
  }
});

// Test 4: Same plaintext produces different ciphertexts (IV randomization)
test('Same plaintext produces different ciphertexts (IV randomization)', () => {
  const plaintext = 'Same message';
  
  const encrypted1 = encryptPayload(plaintext, MASTER_KEY_BASE64);
  const encrypted2 = encryptPayload(plaintext, MASTER_KEY_BASE64);
  
  if (encrypted1.ciphertextBase64 === encrypted2.ciphertextBase64) {
    throw new Error('Same ciphertext for same plaintext (should be different due to IV)');
  }
  
  // But both should decrypt to the same plaintext
  const decrypted1 = decryptPayload(encrypted1, MASTER_KEY_BASE64);
  const decrypted2 = decryptPayload(encrypted2, MASTER_KEY_BASE64);
  
  if (decrypted1 !== plaintext || decrypted2 !== plaintext) {
    throw new Error('Decryption failed for randomized IVs');
  }
});

// Test 5: Tampered ciphertext fails decryption
test('Tampered ciphertext fails decryption', () => {
  const plaintext = 'Original message';
  const encrypted = encryptPayload(plaintext, MASTER_KEY_BASE64);
  
  // Tamper with ciphertext
  const tampered = {
    ...encrypted,
    ciphertextBase64: encrypted.ciphertextBase64.slice(0, -5) + 'XXXXX'
  };
  
  let decrypted;
  try {
    decrypted = decryptPayload(tampered, MASTER_KEY_BASE64);
    throw new Error('Decryption should have failed for tampered ciphertext');
  } catch (err) {
    // Expected: decryption should fail
    if (!err.message.includes('Decryption failed') && !err.message.includes('bad decrypt')) {
      throw new Error(`Unexpected error: ${err.message}`);
    }
  }
});

// Test 6: Wrong key fails decryption
test('Wrong key fails decryption', () => {
  const plaintext = 'Secret message';
  const encrypted = encryptPayload(plaintext, MASTER_KEY_BASE64);
  
  // Generate wrong key
  const wrongKey = Buffer.alloc(32, 0).toString('base64');
  
  try {
    const decrypted = decryptPayload(encrypted, wrongKey);
    throw new Error('Decryption should have failed with wrong key');
  } catch (err) {
    // Expected: decryption should fail
    if (!err.message.includes('Decryption failed') && !err.message.includes('bad decrypt')) {
      throw new Error(`Unexpected error: ${err.message}`);
    }
  }
});

// Test 7: Empty string handling
test('Empty string handling', () => {
  const plaintext = '';
  const encrypted = encryptPayload(plaintext, MASTER_KEY_BASE64);
  const decrypted = decryptPayload(encrypted, MASTER_KEY_BASE64);
  
  if (decrypted !== plaintext) {
    throw new Error('Empty string roundtrip failed');
  }
});

// Test 8: Long text handling
test('Long text handling', () => {
  const plaintext = 'A'.repeat(10000); // 10KB
  const encrypted = encryptPayload(plaintext, MASTER_KEY_BASE64);
  const decrypted = decryptPayload(encrypted, MASTER_KEY_BASE64);
  
  if (decrypted !== plaintext) {
    throw new Error('Long text roundtrip failed');
  }
});

// Test 9: Special characters
test('Special characters handling', () => {
  const plaintext = 'Test with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?/`~';
  const encrypted = encryptPayload(plaintext, MASTER_KEY_BASE64);
  const decrypted = decryptPayload(encrypted, MASTER_KEY_BASE64);
  
  if (decrypted !== plaintext) {
    throw new Error('Special characters roundtrip failed');
  }
});

// Test 10: Unicode characters
test('Unicode characters handling', () => {
  const plaintext = 'Test with unicode: 你好 🌟 🚀 émojis';
  const encrypted = encryptPayload(plaintext, MASTER_KEY_BASE64);
  const decrypted = decryptPayload(encrypted, MASTER_KEY_BASE64);
  
  if (decrypted !== plaintext) {
    throw new Error('Unicode roundtrip failed');
  }
});

// Test 11: PII redaction (if enabled)
test('PII redaction', () => {
  const textWithEmail = 'Contact me at user@example.com';
  const redacted = redactPII(textWithEmail);
  
  if (process.env.REDACT_PII === 'true') {
    if (!redacted.includes('[EMAIL_REDACTED]')) {
      throw new Error('PII redaction should have replaced email');
    }
  } else {
    if (redacted !== textWithEmail) {
      throw new Error('PII redaction should not modify text when disabled');
    }
  }
});

// Summary
console.log('\n📊 Test Summary');
console.log('================');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed');
  process.exit(1);
}

