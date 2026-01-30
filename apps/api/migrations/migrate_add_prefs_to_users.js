/**
 * Migration script to add 'prefs' attribute to Users collection
 * Run once: node migrations/migrate_add_prefs_to_users.js
 * Safe to run multiple times - will skip if attribute already exists
 */

const { awDatabases, config } = require('../config/clients');
const { APPWRITE_DATABASE_ID, APPWRITE_USERS_COLLECTION_ID } = config;

async function addPrefsAttribute() {
    try {
        console.log('🔧 Starting migration: Add prefs attribute to Users collection\n');

        // Validate required configuration
        if (!awDatabases) {
            console.error('❌ Appwrite database client not initialized');
            console.error('   Check your .env file for APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
            process.exit(1);
        }

        if (!APPWRITE_DATABASE_ID || !APPWRITE_USERS_COLLECTION_ID) {
            console.error('❌ Missing required configuration:');
            console.error(`   APPWRITE_DATABASE_ID: ${APPWRITE_DATABASE_ID || 'NOT SET'}`);
            console.error(`   APPWRITE_USERS_COLLECTION_ID: ${APPWRITE_USERS_COLLECTION_ID || 'NOT SET'}`);
            process.exit(1);
        }

        console.log('📋 Configuration:');
        console.log(`   Database ID: ${APPWRITE_DATABASE_ID}`);
        console.log(`   Collection ID: ${APPWRITE_USERS_COLLECTION_ID}\n`);

        // Create the 'prefs' attribute
        console.log('📝 Creating "prefs" attribute...');
        console.log('   Type: String');
        console.log('   Size: 10000');
        console.log('   Required: false');
        console.log('   Array: false');
        console.log('   Unique: false\n');

        // Try multiple approaches (different SDK versions may have different signatures)
        let created = false;
        const attempts = [
            // Try 1: Without default and unique parameters
            async () => {
                await awDatabases.createStringAttribute(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_USERS_COLLECTION_ID,
                    'prefs',
                    10000,
                    false // required
                );
            },
            // Try 2: With array parameter but no default/unique
            async () => {
                await awDatabases.createStringAttribute(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_USERS_COLLECTION_ID,
                    'prefs',
                    10000,
                    false, // required
                    false  // array
                );
            },
            // Try 3: Full signature with empty string default
            async () => {
                await awDatabases.createStringAttribute(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_USERS_COLLECTION_ID,
                    'prefs',
                    10000,
                    false, // required
                    false, // array
                    '',    // default value (empty string)
                    false  // unique
                );
            }
        ];

        for (let i = 0; i < attempts.length && !created; i++) {
            try {
                await attempts[i]();
                console.log(`✅ Successfully created "prefs" attribute! (attempt ${i + 1})`);
                console.log('   The attribute is now available in the Users collection.\n');
                created = true;

                // Wait for attribute to be ready
                console.log('⏳ Waiting for attribute to be fully ready (3 seconds)...');
                await new Promise(resolve => setTimeout(resolve, 3000));

                console.log('✅ Migration complete!\n');
                console.log('📝 Next steps:');
                console.log('   1. Restart your backend server if it\'s running');
                console.log('   2. Test the PATCH /me/prefs endpoint');
                console.log('   3. Verify sound settings can be saved successfully\n');

            } catch (createErr) {
                if (createErr.code === 409) {
                    console.log('ℹ️  Attribute "prefs" already exists. Skipping migration.');
                    console.log('   No changes needed.\n');
                    created = true;
                } else if (i === attempts.length - 1) {
                    // Last attempt failed
                    console.error(`❌ Failed to create "prefs" attribute after ${attempts.length} attempts`);
                    console.error(`   Error: ${createErr.message}`);
                    console.error('   Please check the error and try again.');
                    console.error('   You may need to create the attribute manually in Appwrite Console.');
                    process.exit(1);
                } else {
                    console.warn(`⚠️  Attempt ${i + 1} failed: ${createErr.message}. Trying next approach...`);
                }
            }
        }

    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);

        if (err.message?.includes('fetch failed') || err.message?.includes('ECONNREFUSED')) {
            console.error('\n💡 Network Error - Possible solutions:');
            console.error('   1. Check your internet connection');
            console.error('   2. Verify APPWRITE_ENDPOINT is correct');
            console.error('   3. Check if Appwrite service is accessible');
        } else if (err.code === 401 || err.message?.includes('Unauthorized')) {
            console.error('\n💡 Authentication Error - Check:');
            console.error('   1. APPWRITE_API_KEY is correct');
            console.error('   2. API key has proper permissions');
        }

        if (err.stack && process.env.DEBUG) {
            console.error('\n   Stack:', err.stack);
        }

        process.exit(1);
    }
}

// Run the migration
addPrefsAttribute();
