/**
 * Migration Script: Encrypt Existing Plaintext Data
 * 
 * This script encrypts existing plaintext fields in Appwrite collections:
 * - messages.text -> messages.encrypted
 * - sessions.userMeta -> sessions.encrypted_userMeta
 * - users.sensitiveNotes -> users.encrypted_notes
 * - ai_accuracy.aiText -> ai_accuracy.encrypted_aiText
 * 
 * Usage:
 *   node migrate_encrypt_existing_data.js [--dry-run] [--batch-size=100] [--collection=messages]
 * 
 * Environment:
 *   MASTER_KEY_BASE64 - Required (32 bytes base64-encoded)
 *   APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID
 */

require('dotenv').config();
const { Client, Databases, Query } = require('node-appwrite');
const { encryptPayload, formatForStorage, isEncrypted } = require('../lib/encryption');

const MASTER_KEY_BASE64 = process.env.MASTER_KEY_BASE64;
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100', 10);
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
  console.error('❌ Appwrite configuration missing. Check APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID');
  process.exit(1);
}

// Field mappings: collection -> { plaintextField, encryptedField, backupField }
const FIELD_MAPPINGS = {
  messages: {
    plaintextField: 'text',
    encryptedField: 'encrypted',
    backupField: 'text_plain_removed_at'
  },
  sessions: {
    plaintextField: 'userMeta',
    encryptedField: 'encrypted_userMeta',
    backupField: 'userMeta_plain_removed_at'
  },
  users: {
    plaintextField: 'sensitiveNotes',
    encryptedField: 'encrypted_notes',
    backupField: 'notes_plain_removed_at'
  },
  ai_accuracy: {
    plaintextField: 'aiText',
    encryptedField: 'encrypted_aiText',
    backupField: 'aiText_plain_removed_at'
  }
};

const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT);
client.setProject(APPWRITE_PROJECT_ID);
client.setKey(APPWRITE_API_KEY);
const db = new Databases(client);

async function migrateCollection(collectionId, mapping) {
  console.log(`\n📦 Processing collection: ${collectionId}`);
  console.log(`   Plaintext field: ${mapping.plaintextField}`);
  console.log(`   Encrypted field: ${mapping.encryptedField}`);
  
  let totalProcessed = 0;
  let totalEncrypted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let offset = 0;
  const timestamp = new Date().toISOString();

  while (true) {
    try {
      // Fetch batch of documents
      const result = await db.listDocuments(
        APPWRITE_DATABASE_ID,
        collectionId,
        [],
        BATCH_SIZE,
        offset
      );

      if (result.documents.length === 0) {
        break;
      }

      console.log(`   Processing batch: ${offset} to ${offset + result.documents.length}...`);

      for (const doc of result.documents) {
        totalProcessed++;

        // Skip if already encrypted
        if (doc[mapping.encryptedField] && isEncrypted(doc[mapping.encryptedField])) {
          totalSkipped++;
          continue;
        }

        // Skip if plaintext field is missing or empty
        const plaintextValue = doc[mapping.plaintextField];
        if (!plaintextValue || (typeof plaintextValue === 'string' && plaintextValue.trim() === '')) {
          totalSkipped++;
          continue;
        }

        // Convert to string if needed (e.g., userMeta might be JSON string)
        const plaintext = typeof plaintextValue === 'string' 
          ? plaintextValue 
          : JSON.stringify(plaintextValue);

        if (DRY_RUN) {
          console.log(`   [DRY-RUN] Would encrypt doc ${doc.$id}: ${plaintext.substring(0, 50)}...`);
          totalEncrypted++;
        } else {
          try {
            // Encrypt the plaintext
            const encrypted = encryptPayload(plaintext, MASTER_KEY_BASE64);
            const encryptedStorage = formatForStorage(encrypted);

            // Update document: add encrypted field, backup old field, remove plaintext
            const updateData = {
              [mapping.encryptedField]: encryptedStorage,
              [mapping.backupField]: timestamp
            };

            // Remove plaintext field (set to null to keep schema)
            updateData[mapping.plaintextField] = null;

            await db.updateDocument(
              APPWRITE_DATABASE_ID,
              collectionId,
              doc.$id,
              updateData
            );

            totalEncrypted++;
            if (totalEncrypted % 10 === 0) {
              console.log(`   ✅ Encrypted ${totalEncrypted} documents...`);
            }
          } catch (err) {
            console.error(`   ❌ Error encrypting doc ${doc.$id}:`, err.message);
            totalErrors++;
          }
        }
      }

      offset += result.documents.length;

      // If we got fewer documents than requested, we're done
      if (result.documents.length < BATCH_SIZE) {
        break;
      }
    } catch (err) {
      console.error(`❌ Error processing batch at offset ${offset}:`, err.message);
      totalErrors++;
      break;
    }
  }

  return {
    collection: collectionId,
    totalProcessed,
    totalEncrypted,
    totalSkipped,
    totalErrors
  };
}

async function main() {
  console.log('🔐 Encryption Migration Script');
  console.log('==============================');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no changes will be made)' : 'LIVE (will encrypt data)'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Collection filter: ${COLLECTION_FILTER || 'all'}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY-RUN mode: No data will be modified');
  } else {
    console.log('\n⚠️  LIVE mode: Data will be encrypted and plaintext fields will be removed');
    console.log('   Press Ctrl+C within 5 seconds to cancel...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

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

    try {
      const result = await migrateCollection(collectionId, mapping);
      results.push(result);
    } catch (err) {
      console.error(`❌ Failed to migrate collection ${collectionId}:`, err.message);
      results.push({
        collection: collectionId,
        totalProcessed: 0,
        totalEncrypted: 0,
        totalSkipped: 0,
        totalErrors: 1
      });
    }
  }

  // Summary
  console.log('\n📊 Migration Summary');
  console.log('====================');
  const grandTotal = {
    processed: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0
  };

  results.forEach(r => {
    console.log(`\n${r.collection}:`);
    console.log(`  Processed: ${r.totalProcessed}`);
    console.log(`  Encrypted: ${r.totalEncrypted}`);
    console.log(`  Skipped: ${r.totalSkipped}`);
    console.log(`  Errors: ${r.totalErrors}`);
    
    grandTotal.processed += r.totalProcessed;
    grandTotal.encrypted += r.totalEncrypted;
    grandTotal.skipped += r.totalSkipped;
    grandTotal.errors += r.totalErrors;
  });

  console.log('\n📈 Grand Total:');
  console.log(`  Processed: ${grandTotal.processed}`);
  console.log(`  Encrypted: ${grandTotal.encrypted}`);
  console.log(`  Skipped: ${grandTotal.skipped}`);
  console.log(`  Errors: ${grandTotal.errors}`);

  if (DRY_RUN) {
    console.log('\n✅ Dry-run completed. Run without --dry-run to perform actual encryption.');
  } else {
    console.log('\n✅ Migration completed!');
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

