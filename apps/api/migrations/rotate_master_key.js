/**
 * Master Key Rotation Script
 * 
 * This script rotates the master encryption key by re-encrypting data keys
 * (not the payloads themselves - envelope encryption allows key rotation without re-encrypting data).
 * 
 * IMPORTANT: This only rewraps the data keys. The payloads remain encrypted with their original data keys.
 * 
 * Usage:
 *   node rotate_master_key.js [--preview] [--batch-size=100] [--collection=messages]
 * 
 * Environment:
 *   MASTER_KEY_BASE64 - Current master key (32 bytes base64)
 *   NEW_MASTER_KEY_BASE64 - New master key (32 bytes base64)
 *   APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID
 */

require('dotenv').config();
const { Client, Databases } = require('node-appwrite');
const crypto = require('crypto');
const { parseFromStorage, formatForStorage, isEncrypted } = require('../lib/encryption');

const MASTER_KEY_BASE64 = process.env.MASTER_KEY_BASE64;
const NEW_MASTER_KEY_BASE64 = process.env.NEW_MASTER_KEY_BASE64;
const PREVIEW = process.argv.includes('--preview');
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100', 10);
const COLLECTION_FILTER = process.argv.find(arg => arg.startsWith('--collection='))?.split('=')[1];

if (!MASTER_KEY_BASE64) {
  console.error('❌ MASTER_KEY_BASE64 environment variable is required');
  process.exit(1);
}

if (!NEW_MASTER_KEY_BASE64) {
  console.error('❌ NEW_MASTER_KEY_BASE64 environment variable is required');
  process.exit(1);
}

// Validate key lengths
const oldKey = Buffer.from(MASTER_KEY_BASE64, 'base64');
const newKey = Buffer.from(NEW_MASTER_KEY_BASE64, 'base64');
if (oldKey.length !== 32 || newKey.length !== 32) {
  console.error('❌ Both keys must be 32 bytes (256 bits) when base64-decoded');
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

// Field mappings: collection -> encryptedField
const FIELD_MAPPINGS = {
  messages: { encryptedField: 'encrypted' },
  sessions: { encryptedField: 'encrypted_userMeta' },
  users: { encryptedField: 'encrypted_notes' },
  ai_accuracy: { encryptedField: 'encrypted_aiText' }
};

const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT);
client.setProject(APPWRITE_PROJECT_ID);
client.setKey(APPWRITE_API_KEY);
const db = new Databases(client);

/**
 * Decrypt data key using old master key
 */
function decryptDataKey(encryptedDataKeyBase64, ivBase64, tagBase64, masterKey) {
  const iv = Buffer.from(ivBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');
  const encryptedDataKey = Buffer.from(encryptedDataKeyBase64, 'base64');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(tag);
  decipher.setAAD(Buffer.from('data-key'));
  
  let dataKey = decipher.update(encryptedDataKey);
  dataKey = Buffer.concat([dataKey, decipher.final()]);
  
  return dataKey;
}

/**
 * Encrypt data key using new master key
 */
function encryptDataKey(dataKey, masterKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  cipher.setAAD(Buffer.from('data-key'));
  
  let encryptedDataKey = cipher.update(dataKey);
  encryptedDataKey = Buffer.concat([encryptedDataKey, cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return {
    encryptedDataKeyBase64: encryptedDataKey.toString('base64'),
    ivBase64: iv.toString('base64'),
    tagBase64: tag.toString('base64')
  };
}

async function rotateCollection(collectionId, mapping) {
  console.log(`\n📦 Processing collection: ${collectionId}`);
  console.log(`   Encrypted field: ${mapping.encryptedField}`);
  
  let totalProcessed = 0;
  let totalRotated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let offset = 0;

  while (true) {
    try {
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

        const encryptedField = doc[mapping.encryptedField];
        
        // Skip if not encrypted
        if (!encryptedField || !isEncrypted(encryptedField)) {
          totalSkipped++;
          continue;
        }

        // Skip if already using new key format (has dkiv and dktag)
        if (encryptedField.dkiv && encryptedField.dktag) {
          // Check if it's using the new key (we can't verify without decrypting, so we'll skip for now)
          // In production, you might want to add a version field to track key rotation
          totalSkipped++;
          continue;
        }

        try {
          // Parse encrypted data
          const encrypted = parseFromStorage(encryptedField);
          
          // Check if we have data key IV/tag (new format)
          if (!encrypted.dataKeyIv || !encrypted.dataKeyTag) {
            console.warn(`   ⚠️  Doc ${doc.$id}: Legacy format (no dkiv/dktag), cannot rotate. Re-encrypt data first.`);
            totalSkipped++;
            continue;
          }
          
          // Decrypt data key using old master key
          const dataKey = decryptDataKey(
            encrypted.encryptedDataKeyBase64,
            encrypted.dataKeyIv,
            encrypted.dataKeyTag,
            oldKey
          );

          // Re-encrypt data key with new master key
          const newDataKeyEncryption = encryptDataKey(dataKey, newKey);

          // Update encrypted field with new wrapped data key
          const updatedEncrypted = {
            ...encryptedField,
            k: newDataKeyEncryption.encryptedDataKeyBase64,
            dkiv: newDataKeyEncryption.ivBase64,
            dktag: newDataKeyEncryption.tagBase64
          };

          if (PREVIEW) {
            console.log(`   [PREVIEW] Would rotate key for doc ${doc.$id}`);
            totalRotated++;
          } else {
            await db.updateDocument(
              APPWRITE_DATABASE_ID,
              collectionId,
              doc.$id,
              { [mapping.encryptedField]: updatedEncrypted }
            );

            totalRotated++;
            if (totalRotated % 10 === 0) {
              console.log(`   ✅ Rotated ${totalRotated} keys...`);
            }
          }
        } catch (err) {
          console.error(`   ❌ Error rotating key for doc ${doc.$id}:`, err.message);
          totalErrors++;
        }
      }

      offset += result.documents.length;

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
    totalRotated,
    totalSkipped,
    totalErrors
  };
}

async function main() {
  console.log('🔄 Master Key Rotation Script');
  console.log('==============================');
  console.log(`Mode: ${PREVIEW ? 'PREVIEW (no changes will be made)' : 'LIVE (will rotate keys)'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Collection filter: ${COLLECTION_FILTER || 'all'}`);

  if (PREVIEW) {
    console.log('\n⚠️  PREVIEW mode: No data will be modified');
  } else {
    console.log('\n⚠️  LIVE mode: Data keys will be re-encrypted with new master key');
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
      const result = await rotateCollection(collectionId, mapping);
      results.push(result);
    } catch (err) {
      console.error(`❌ Failed to rotate collection ${collectionId}:`, err.message);
      results.push({
        collection: collectionId,
        totalProcessed: 0,
        totalRotated: 0,
        totalSkipped: 0,
        totalErrors: 1
      });
    }
  }

  // Summary
  console.log('\n📊 Rotation Summary');
  console.log('====================');
  const grandTotal = {
    processed: 0,
    rotated: 0,
    skipped: 0,
    errors: 0
  };

  results.forEach(r => {
    console.log(`\n${r.collection}:`);
    console.log(`  Processed: ${r.totalProcessed}`);
    console.log(`  Rotated: ${r.totalRotated}`);
    console.log(`  Skipped: ${r.totalSkipped}`);
    console.log(`  Errors: ${r.totalErrors}`);
    
    grandTotal.processed += r.totalProcessed;
    grandTotal.rotated += r.totalRotated;
    grandTotal.skipped += r.totalSkipped;
    grandTotal.errors += r.totalErrors;
  });

  console.log('\n📈 Grand Total:');
  console.log(`  Processed: ${grandTotal.processed}`);
  console.log(`  Rotated: ${grandTotal.rotated}`);
  console.log(`  Skipped: ${grandTotal.skipped}`);
  console.log(`  Errors: ${grandTotal.errors}`);

  if (PREVIEW) {
    console.log('\n✅ Preview completed. Run without --preview to perform actual rotation.');
  } else {
    console.log('\n✅ Key rotation completed!');
    console.log('⚠️  Remember to update MASTER_KEY_BASE64 in your environment to the new key.');
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

