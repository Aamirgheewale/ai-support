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
          await databases.createStringAttribute(
            APPWRITE_DATABASE_ID,
            'users',
            attr.name,
            attr.size,
            attr.required,
            attr.array,
            attr.unique
          );
          console.log(`   ✅ Added attribute: ${attr.name}`);
        } else if (attr.type === 'datetime') {
          await databases.createDatetimeAttribute(
            APPWRITE_DATABASE_ID,
            'users',
            attr.name,
            attr.required,
            false
          );
          console.log(`   ✅ Added attribute: ${attr.name}`);
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
      } else {
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
          await databases.createStringAttribute(
            APPWRITE_DATABASE_ID,
            'roleChanges',
            attr.name,
            attr.size,
            attr.required,
            attr.array,
            attr.unique
          );
          console.log(`   ✅ Added attribute: ${attr.name}`);
        } else if (attr.type === 'datetime') {
          await databases.createDatetimeAttribute(
            APPWRITE_DATABASE_ID,
            'roleChanges',
            attr.name,
            attr.required,
            false
          );
          console.log(`   ✅ Added attribute: ${attr.name}`);
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
    if (err.response) {
      try {
        const response = JSON.parse(err.response);
        console.error('   Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.error('   Response:', err.response);
      }
    }
    process.exit(1);
  }
}

createCollections();
