/**
 * Sample Decryption Test Script
 * 
 * This script tests decryption on a sample of encrypted documents
 * to verify that encryption/decryption is working correctly.
 * 
 * Usage:
 *   node migrate_decrypt_sample.js [--limit=10] [--collection=messages]
 * 
 * Environment:
 *   MASTER_KEY_BASE64 - Required (32 bytes base64-encoded)
 *   APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID
 */

require('dotenv').config();
const { Client, Databases } = require('node-appwrite');
const { decryptPayload, parseFromStorage, isEncrypted } = require('../lib/encryption');

const MASTER_KEY_BASE64 = process.env.MASTER_KEY_BASE64;
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '10', 10);
const COLLECTION_FILTER = process.argv.find(arg => arg.startsWith('--collection='))?.split('=')[1];

if (!MASTER_KEY_BASE64) {
  console.error('❌ MASTER_KEY_BASE64 environment variable is required');
  process.exit(1);
}

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !APPWRITE_DATABASE_ID) {
  console.error('❌ Appwrite configuration missing');
  process.exit(1);
}

// Field mappings
const FIELD_MAPPINGS = {
  messages: { encryptedField: 'encrypted', displayField: 'text' },
  sessions: { encryptedField: 'encrypted_userMeta', displayField: 'userMeta' },
  users: { encryptedField: 'encrypted_notes', displayField: 'sensitiveNotes' },
  ai_accuracy: { encryptedField: 'encrypted_aiText', displayField: 'aiText' }
};

const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT);
client.setProject(APPWRITE_PROJECT_ID);
client.setKey(APPWRITE_API_KEY);
const db = new Databases(client);

async function testDecryption(collectionId, mapping) {
  console.log(`\n📦 Testing collection: ${collectionId}`);
  console.log(`   Encrypted field: ${mapping.encryptedField}`);
  
  try {
    // Fetch sample documents
    const result = await db.listDocuments(
      APPWRITE_DATABASE_ID,
      collectionId,
      [],
      LIMIT,
      0
    );

    if (result.documents.length === 0) {
      console.log('   ⚠️  No documents found');
      return { collection: collectionId, tested: 0, success: 0, failed: 0 };
    }

    let tested = 0;
    let success = 0;
    let failed = 0;

    for (const doc of result.documents) {
      const encryptedField = doc[mapping.encryptedField];
      
      if (!encryptedField || !isEncrypted(encryptedField)) {
        console.log(`   ⏭️  Doc ${doc.$id}: Not encrypted, skipping`);
        continue;
      }

      tested++;

      try {
        const encrypted = parseFromStorage(encryptedField);
        const decrypted = decryptPayload(encrypted, MASTER_KEY_BASE64);
        
        console.log(`   ✅ Doc ${doc.$id}: Decrypted successfully`);
        console.log(`      Preview: ${decrypted.substring(0, 100)}${decrypted.length > 100 ? '...' : ''}`);
        success++;
      } catch (err) {
        console.error(`   ❌ Doc ${doc.$id}: Decryption failed - ${err.message}`);
        failed++;
      }
    }

    return { collection: collectionId, tested, success, failed };
  } catch (err) {
    console.error(`❌ Error testing collection ${collectionId}:`, err.message);
    return { collection: collectionId, tested: 0, success: 0, failed: 1 };
  }
}

async function main() {
  console.log('🔓 Sample Decryption Test Script');
  console.log('=================================');
  console.log(`Sample limit: ${LIMIT} documents per collection`);
  console.log(`Collection filter: ${COLLECTION_FILTER || 'all'}`);

  const collections = COLLECTION_FILTER 
    ? [COLLECTION_FILTER].filter(c => FIELD_MAPPINGS[c])
    : Object.keys(FIELD_MAPPINGS);

  const results = [];

  for (const collectionId of collections) {
    const mapping = FIELD_MAPPINGS[collectionId];
    if (!mapping) {
      console.warn(`⚠️  Skipping unknown collection: ${collectionId}`);
      continue;
    }

    const result = await testDecryption(collectionId, mapping);
    results.push(result);
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  const grandTotal = {
    tested: 0,
    success: 0,
    failed: 0
  };

  results.forEach(r => {
    console.log(`\n${r.collection}:`);
    console.log(`  Tested: ${r.tested}`);
    console.log(`  Success: ${r.success}`);
    console.log(`  Failed: ${r.failed}`);
    
    grandTotal.tested += r.tested;
    grandTotal.success += r.success;
    grandTotal.failed += r.failed;
  });

  console.log('\n📈 Grand Total:');
  console.log(`  Tested: ${grandTotal.tested}`);
  console.log(`  Success: ${grandTotal.success}`);
  console.log(`  Failed: ${grandTotal.failed}`);

  if (grandTotal.failed === 0 && grandTotal.tested > 0) {
    console.log('\n✅ All decryption tests passed!');
  } else if (grandTotal.tested === 0) {
    console.log('\n⚠️  No encrypted documents found to test');
  } else {
    console.log('\n❌ Some decryption tests failed');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

