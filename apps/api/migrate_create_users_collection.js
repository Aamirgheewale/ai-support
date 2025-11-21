/**
 * Migration script to create users and roleChanges collections in Appwrite
 * Run once: node migrate_create_users_collection.js
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
    
    console.log('📦 Creating collections...');
    
    // Create users collection
    try {
      const usersCollection = await databases.createCollection(
        APPWRITE_DATABASE_ID,
        'users',
        'Users',
        [
          Permission.read(Role.any()), // Allow read for authenticated users
          Permission.create(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any())
        ],
        false // No document security
      );
      console.log('✅ Created users collection');
      
      // Add attributes
      await databases.createStringAttribute(
        APPWRITE_DATABASE_ID,
        'users',
        'userId',
        255,
        true, // required
        false, // not array
        true  // unique
      );
      
      await databases.createStringAttribute(
        APPWRITE_DATABASE_ID,
        'users',
        'email',
        255,
        true,
        false,
        true
      );
      
      await databases.createStringAttribute(
        APPWRITE_DATABASE_ID,
        'users',
        'name',
        255,
        false,
        false,
        false
      );
      
      await databases.createStringAttribute(
        APPWRITE_DATABASE_ID,
        'users',
        'roles',
        255,
        false,
        true, // array
        false
      );
      
      // Create datetime attributes without default (Appwrite doesn't accept null, omit parameter)
      await databases.createDatetimeAttribute(
        APPWRITE_DATABASE_ID,
        'users',
        'createdAt',
        true,
        false
      );
      
      await databases.createDatetimeAttribute(
        APPWRITE_DATABASE_ID,
        'users',
        'updatedAt',
        false,
        false
      );
      
      console.log('✅ Added users collection attributes');
      
      // Wait for attributes to be ready
      console.log('⏳ Waiting for attributes to be ready...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (err) {
      if (err.code === 409) {
        console.log('ℹ️  users collection already exists');
      } else {
        throw err;
      }
    }
    
    // Create roleChanges collection for audit logging
    try {
      const roleChangesCollection = await databases.createCollection(
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
    
    // Add roleChanges attributes
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
        } else if (attr.type === 'datetime') {
          await databases.createDatetimeAttribute(
            APPWRITE_DATABASE_ID,
            'roleChanges',
            attr.name,
            attr.required,
            false
          );
        }
        console.log(`   ✅ Added attribute: ${attr.name}`);
      } catch (attrErr) {
        if (attrErr.code === 409) {
          console.log(`   ℹ️  Attribute ${attr.name} already exists`);
        } else {
          console.warn(`   ⚠️  Failed to add attribute ${attr.name}:`, attrErr.message);
        }
      }
    }
    
    console.log('✅ RoleChanges collection attributes ready');
    
    // Wait for attributes to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Create a super_admin user via API: POST /admin/users');
    console.log('   2. Use that user\'s token for admin operations');
    console.log('   3. For dev, ADMIN_SHARED_SECRET token maps to super_admin');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.response) {
      console.error('   Response:', JSON.stringify(err.response, null, 2));
    }
    process.exit(1);
  }
}

createCollections();

