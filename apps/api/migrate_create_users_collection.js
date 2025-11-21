/**
 * Migration script to create users and roleChanges collections in Appwrite
 * Run once: node migrate_create_users_collection.js
 * Safe to run multiple times - will skip existing collections/attributes
 */

require('dotenv').config();

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !APPWRITE_DATABASE_ID) {
  console.error('❌ Missing required Appwrite environment variables:');
  console.error('   Required: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID');
  process.exit(1);
}

async function createCollections() {
  try {
    const { Client, Databases, ID, Permission, Role } = require('node-appwrite');
    
    const client = new Client();
    client.setEndpoint(APPWRITE_ENDPOINT);
    client.setProject(APPWRITE_PROJECT_ID);
    client.setKey(APPWRITE_API_KEY);
    
    const databases = new Databases(client);
    
    // Test connection first by trying to list collections
    console.log('🔌 Testing Appwrite connection...');
    try {
      // Try to list collections from the database to verify connection
      await databases.listCollections(APPWRITE_DATABASE_ID, []);
      console.log('✅ Appwrite connection successful\n');
    } catch (connErr) {
      // If collection listing fails, it might be because database is empty or doesn't exist
      // Try a simpler test - just verify we can make an API call
      if (connErr.code === 404) {
        console.log('⚠️  Database might be empty, but connection works. Proceeding...\n');
      } else {
        console.error('❌ Failed to connect to Appwrite:', connErr.message);
        if (connErr.message?.includes('fetch failed') || connErr.message?.includes('ECONNREFUSED')) {
          console.error('   This might be a network issue. Check:');
          console.error('   1. Your internet connection');
          console.error('   2. APPWRITE_ENDPOINT is correct:', APPWRITE_ENDPOINT);
          console.error('   3. Firewall/proxy settings');
          console.error('   4. APPWRITE_DATABASE_ID is correct:', APPWRITE_DATABASE_ID);
        }
        throw connErr;
      }
    }
    
    console.log('📦 Creating collections...\n');
    
    // Create users collection
    try {
      await databases.createCollection(
        APPWRITE_DATABASE_ID,
        'users',
        'Users',
        [
          Permission.read(Role.any()),
          Permission.create(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any())
        ],
        false
      );
      console.log('✅ Created users collection');
    } catch (err) {
      if (err.code === 409) {
        console.log('ℹ️  users collection already exists');
      } else {
        throw err;
      }
    }
    
    // Add attributes to users collection (try each one, skip if exists)
    console.log('📝 Adding attributes to users collection...');
    const userAttributes = [
      { name: 'userId', type: 'string', size: 255, required: true, array: false, unique: true },
      { name: 'email', type: 'string', size: 255, required: true, array: false, unique: true },
      { name: 'name', type: 'string', size: 255, required: false, array: false, unique: false },
      { name: 'roles', type: 'string', size: 255, required: false, array: true, unique: false },
      { name: 'createdAt', type: 'datetime', required: true },
      { name: 'updatedAt', type: 'datetime', required: false }
    ];
    
    for (const attr of userAttributes) {
      try {
        if (attr.type === 'string') {
          // createStringAttribute: Try multiple approaches for default parameter
          // Signature: (databaseId, collectionId, key, size, required, array, default, unique)
          let created = false;
          const attempts = [
            // Try 1: Pass null explicitly
            async () => {
              await databases.createStringAttribute(
                APPWRITE_DATABASE_ID,
                'users',
                attr.name,
                attr.size,
                attr.required,
                attr.array,
                null, // null for no default
                attr.unique
              );
            },
            // Try 2: Pass empty string
            async () => {
              await databases.createStringAttribute(
                APPWRITE_DATABASE_ID,
                'users',
                attr.name,
                attr.size,
                attr.required,
                attr.array,
                '', // empty string
                attr.unique
              );
            },
            // Try 3: Use undefined (might skip the parameter)
            async () => {
              await databases.createStringAttribute(
                APPWRITE_DATABASE_ID,
                'users',
                attr.name,
                attr.size,
                attr.required,
                attr.array,
                undefined, // undefined
                attr.unique
              );
            }
          ];
          
          for (let i = 0; i < attempts.length && !created; i++) {
            try {
              await attempts[i]();
              console.log(`   ✅ Added attribute: ${attr.name} (attempt ${i + 1})`);
              created = true;
            } catch (attemptErr) {
              if (i === attempts.length - 1) {
                // Last attempt failed
                console.warn(`   ⚠️  Failed to add attribute ${attr.name} after ${attempts.length} attempts`);
                console.warn(`      Error: ${attemptErr.message}`);
                console.warn(`      Please create this attribute manually in Appwrite Console`);
                console.warn(`      See MANUAL_ATTRIBUTE_SETUP.md for details`);
              }
            }
          }
        } else if (attr.type === 'datetime') {
          // createDatetimeAttribute: Try without default parameter
          let created = false;
          const attempts = [
            // Try 1: Omit default parameter entirely
            async () => {
              await databases.createDatetimeAttribute(
                APPWRITE_DATABASE_ID,
                'users',
                attr.name,
                attr.required,
                false // array
              );
            },
            // Try 2: Pass null
            async () => {
              await databases.createDatetimeAttribute(
                APPWRITE_DATABASE_ID,
                'users',
                attr.name,
                attr.required,
                false, // array
                null
              );
            },
            // Try 3: Pass undefined
            async () => {
              await databases.createDatetimeAttribute(
                APPWRITE_DATABASE_ID,
                'users',
                attr.name,
                attr.required,
                false, // array
                undefined
              );
            }
          ];
          
          for (let i = 0; i < attempts.length && !created; i++) {
            try {
              await attempts[i]();
              console.log(`   ✅ Added attribute: ${attr.name} (attempt ${i + 1})`);
              created = true;
            } catch (attemptErr) {
              if (i === attempts.length - 1) {
                console.warn(`   ⚠️  Failed to add attribute ${attr.name} after ${attempts.length} attempts`);
                console.warn(`      Error: ${attemptErr.message}`);
                console.warn(`      Please create this attribute manually in Appwrite Console`);
                console.warn(`      See MANUAL_ATTRIBUTE_SETUP.md for details`);
              }
            }
          }
        }
      } catch (attrErr) {
        if (attrErr.code === 409) {
          console.log(`   ℹ️  Attribute ${attr.name} already exists`);
        } else {
          console.warn(`   ⚠️  Failed to add attribute ${attr.name}:`, attrErr.message);
        }
      }
    }
    
    console.log('✅ Users collection ready\n');
    
    // Wait for attributes to be ready
    console.log('⏳ Waiting for attributes to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create roleChanges collection for audit logging
    try {
      await databases.createCollection(
        APPWRITE_DATABASE_ID,
        'roleChanges',
        'Role Changes',
        [
          Permission.read(Role.any()),
          Permission.create(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any())
        ],
        false
      );
      console.log('✅ Created roleChanges collection');
    } catch (err) {
      if (err.code === 409) {
        console.log('ℹ️  roleChanges collection already exists');
      } else if (err.message?.includes('fetch failed')) {
        console.error('❌ Network error creating roleChanges collection');
        throw err;
      } else {
        console.error('❌ Error creating roleChanges collection:', err.message);
        throw err;
      }
    }
    
    // Add attributes to roleChanges collection
    console.log('📝 Adding attributes to roleChanges collection...');
    const roleChangeAttributes = [
      { name: 'userId', type: 'string', size: 255, required: true, array: false, unique: false },
      { name: 'changedBy', type: 'string', size: 255, required: true, array: false, unique: false },
      { name: 'oldRoles', type: 'string', size: 255, required: false, array: true, unique: false },
      { name: 'newRoles', type: 'string', size: 255, required: false, array: true, unique: false },
      { name: 'createdAt', type: 'datetime', required: true }
    ];
    
    for (const attr of roleChangeAttributes) {
      try {
        if (attr.type === 'string') {
          // createStringAttribute: Try multiple approaches
          let created = false;
          const attempts = [
            async () => {
              await databases.createStringAttribute(
                APPWRITE_DATABASE_ID,
                'roleChanges',
                attr.name,
                attr.size,
                attr.required,
                attr.array,
                null, // null for no default
                attr.unique
              );
            },
            async () => {
              await databases.createStringAttribute(
                APPWRITE_DATABASE_ID,
                'roleChanges',
                attr.name,
                attr.size,
                attr.required,
                attr.array,
                '', // empty string
                attr.unique
              );
            },
            async () => {
              await databases.createStringAttribute(
                APPWRITE_DATABASE_ID,
                'roleChanges',
                attr.name,
                attr.size,
                attr.required,
                attr.array,
                undefined, // undefined
                attr.unique
              );
            }
          ];
          
          for (let i = 0; i < attempts.length && !created; i++) {
            try {
              await attempts[i]();
              console.log(`   ✅ Added attribute: ${attr.name} (attempt ${i + 1})`);
              created = true;
            } catch (attemptErr) {
              if (i === attempts.length - 1) {
                console.warn(`   ⚠️  Failed to add attribute ${attr.name} after ${attempts.length} attempts`);
                console.warn(`      Error: ${attemptErr.message}`);
                console.warn(`      Please create this attribute manually in Appwrite Console`);
                console.warn(`      See MANUAL_ATTRIBUTE_SETUP.md for details`);
              }
            }
          }
        } else if (attr.type === 'datetime') {
          let created = false;
          const attempts = [
            async () => {
              await databases.createDatetimeAttribute(
                APPWRITE_DATABASE_ID,
                'roleChanges',
                attr.name,
                attr.required,
                false // array
              );
            },
            async () => {
              await databases.createDatetimeAttribute(
                APPWRITE_DATABASE_ID,
                'roleChanges',
                attr.name,
                attr.required,
                false, // array
                null
              );
            },
            async () => {
              await databases.createDatetimeAttribute(
                APPWRITE_DATABASE_ID,
                'roleChanges',
                attr.name,
                attr.required,
                false, // array
                undefined
              );
            }
          ];
          
          for (let i = 0; i < attempts.length && !created; i++) {
            try {
              await attempts[i]();
              console.log(`   ✅ Added attribute: ${attr.name} (attempt ${i + 1})`);
              created = true;
            } catch (attemptErr) {
              if (i === attempts.length - 1) {
                console.warn(`   ⚠️  Failed to add attribute ${attr.name} after ${attempts.length} attempts`);
                console.warn(`      Error: ${attemptErr.message}`);
                console.warn(`      Please create this attribute manually in Appwrite Console`);
                console.warn(`      See MANUAL_ATTRIBUTE_SETUP.md for details`);
              }
            }
          }
        }
      } catch (attrErr) {
        if (attrErr.code === 409) {
          console.log(`   ℹ️  Attribute ${attr.name} already exists`);
        } else {
          console.warn(`   ⚠️  Failed to add attribute ${attr.name}:`, attrErr.message);
        }
      }
    }
    
    console.log('✅ RoleChanges collection ready\n');
    
    // Wait for attributes to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your backend server: node index.js');
    console.log('   2. Test RBAC: node test_rbac.js');
    console.log('   3. For dev, ADMIN_SHARED_SECRET token maps to super_admin');
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    
    // Provide helpful error messages
    if (err.message?.includes('fetch failed') || err.message?.includes('ECONNREFUSED')) {
      console.error('\n💡 Network Error - Possible solutions:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify APPWRITE_ENDPOINT:', APPWRITE_ENDPOINT);
      console.error('   3. Check if Appwrite service is accessible');
      console.error('   4. Try again in a few moments');
    } else if (err.code === 401 || err.message?.includes('Unauthorized')) {
      console.error('\n💡 Authentication Error - Check:');
      console.error('   1. APPWRITE_API_KEY is correct');
      console.error('   2. API key has proper permissions (databases.read, databases.write, collections.read, collections.write)');
    } else if (err.code === 404 || err.message?.includes('not found')) {
      console.error('\n💡 Not Found Error - Check:');
      console.error('   1. APPWRITE_DATABASE_ID is correct:', APPWRITE_DATABASE_ID);
      console.error('   2. Database exists in your Appwrite project');
    }
    
    if (err.response) {
      try {
        const response = JSON.parse(err.response);
        console.error('\n   Detailed Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.error('\n   Response:', err.response);
      }
    }
    
    if (err.stack && process.env.DEBUG) {
      console.error('\n   Stack:', err.stack);
    }
    
    process.exit(1);
  }
}

createCollections();

