/**
 * Migration Dry-Run Test
 * 
 * Tests that the migration script works correctly in dry-run mode.
 * 
 * Usage:
 *   node tests/test_migration_dryrun.js
 * 
 * Environment:
 *   MASTER_KEY_BASE64 - Required
 *   APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const MASTER_KEY_BASE64 = process.env.MASTER_KEY_BASE64;

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

console.log('🧪 Migration Dry-Run Test');
console.log('===========================\n');

const migrationScript = path.join(__dirname, '../migrations/migrate_encrypt_existing_data.js');

console.log('Running migration script in dry-run mode...\n');

const child = spawn('node', [migrationScript, '--dry-run', '--batch-size=10'], {
  env: {
    ...process.env,
    MASTER_KEY_BASE64
  },
  stdio: 'inherit'
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migration dry-run test completed successfully');
    process.exit(0);
  } else {
    console.error(`\n❌ Migration dry-run test failed with code ${code}`);
    process.exit(1);
  }
});

child.on('error', (err) => {
  console.error('❌ Failed to spawn migration script:', err);
  process.exit(1);
});

