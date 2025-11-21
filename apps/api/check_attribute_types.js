/**
 * Diagnostic script to check if attributes are configured correctly
 * Run: node check_attribute_types.js
 */

require('dotenv').config();
const { Client, Databases, Query } = require('node-appwrite');

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPWRITE_USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID || 'users';

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !APPWRITE_DATABASE_ID) {
  console.error('❌ Missing Appwrite configuration in .env file');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

const APPWRITE_ROLE_CHANGES_COLLECTION_ID = process.env.APPWRITE_ROLE_CHANGES_COLLECTION_ID || 'roleChanges';

async function checkUsersCollection() {
  console.log('🔍 Checking attribute types in users collection...\n');
  
  try {
    console.log('📋 Users Collection attributes:');
    console.log('─'.repeat(60));
    
    let hasErrors = false;
    
    // Check each expected attribute
    const expectedAttributes = {
      userId: { type: 'string', array: false, required: true, unique: true },
      email: { type: 'string', array: false, required: true, unique: true },
      name: { type: 'string', array: false, required: false, unique: false },
      roles: { type: 'string', array: true, required: false, unique: false }, // IMPORTANT: array=true
      createdAt: { type: 'datetime', array: false, required: true },
      updatedAt: { type: 'datetime', array: false, required: false }
    };
    
    // Get all attributes
    const attributes = await databases.listAttributes(
      APPWRITE_DATABASE_ID,
      APPWRITE_USERS_COLLECTION_ID
    );
    
    const attrMap = {};
    attributes.attributes.forEach(attr => {
      attrMap[attr.key] = attr;
    });
    
    for (const [key, expected] of Object.entries(expectedAttributes)) {
      const actual = attrMap[key];
      
      if (!actual) {
        console.log(`❌ ${key}: MISSING`);
        hasErrors = true;
        continue;
      }
      
      const issues = [];
      
      // Check type
      if (actual.type !== expected.type) {
        issues.push(`type=${actual.type} (expected ${expected.type})`);
      }
      
      // Check array
      if (actual.array !== expected.array) {
        issues.push(`array=${actual.array} (expected ${expected.array})`);
        if (key === 'roles' && actual.array === false) {
          console.log(`\n⚠️  CRITICAL: "${key}" is configured as String but MUST be String Array!`);
          console.log(`   This will cause errors when saving roles.`);
          console.log(`   Fix: Delete the "roles" attribute and recreate it with Array=Yes\n`);
        }
      }
      
      // Check required
      if (actual.required !== expected.required) {
        issues.push(`required=${actual.required} (expected ${expected.required})`);
      }
      
      // Note: Unique constraint is enforced via Indexes, not attribute property
      // We'll check indexes separately below
      
      if (issues.length > 0) {
        console.log(`⚠️  ${key}: ${issues.join(', ')}`);
        hasErrors = true;
      } else {
        console.log(`✅ ${key}: OK`);
      }
    }
    
    console.log('\n' + '─'.repeat(60));
    
    // Check for unique indexes
    console.log('\n🔍 Checking unique indexes...');
    try {
      const indexes = await databases.listIndexes(
        APPWRITE_DATABASE_ID,
        APPWRITE_USERS_COLLECTION_ID
      );
      
      const indexMap = {};
      indexes.indexes.forEach(idx => {
        idx.attributes.forEach(attr => {
          if (!indexMap[attr.key]) {
            indexMap[attr.key] = [];
          }
          indexMap[attr.key].push({ type: idx.type, name: idx.key });
        });
      });
      
      // Check if userId has unique index
      if (!indexMap['userId'] || !indexMap['userId'].some(i => i.type === 'unique')) {
        console.log('⚠️  userId: Missing unique index');
        console.log('   Create index: Name=idx_userId_unique, Attribute=userId, Type=Unique');
        hasErrors = true;
      } else {
        console.log('✅ userId: Has unique index');
      }
      
      // Check if email has unique index
      if (!indexMap['email'] || !indexMap['email'].some(i => i.type === 'unique')) {
        console.log('⚠️  email: Missing unique index');
        console.log('   Create index: Name=idx_email_unique, Attribute=email, Type=Unique');
        hasErrors = true;
      } else {
        console.log('✅ email: Has unique index');
      }
    } catch (idxErr) {
      console.warn('⚠️  Could not check indexes:', idxErr.message);
    }
    
    return hasErrors;
    
  } catch (err) {
    console.error('❌ Error checking users collection:', err.message);
    if (err.code === 404) {
      console.error('   Collection not found. Please create the users collection first.');
    }
    return true;
  }
}

async function checkRoleChangesCollection() {
  console.log('\n🔍 Checking attribute types in roleChanges collection...\n');
  
  try {
    console.log('📋 RoleChanges Collection attributes:');
    console.log('─'.repeat(60));
    
    let hasErrors = false;
    
    // Check each expected attribute
    const expectedAttributes = {
      userId: { type: 'string', array: false, required: true, unique: false },
      changedBy: { type: 'string', array: false, required: true, unique: false },
      oldRoles: { type: 'string', array: true, required: false, unique: false }, // IMPORTANT: array=true
      newRoles: { type: 'string', array: true, required: false, unique: false }, // IMPORTANT: array=true
      createdAt: { type: 'datetime', array: false, required: true }
    };
    
    // Get all attributes
    const attributes = await databases.listAttributes(
      APPWRITE_DATABASE_ID,
      APPWRITE_ROLE_CHANGES_COLLECTION_ID
    );
    
    const attrMap = {};
    attributes.attributes.forEach(attr => {
      attrMap[attr.key] = attr;
    });
    
    for (const [key, expected] of Object.entries(expectedAttributes)) {
      const actual = attrMap[key];
      
      if (!actual) {
        console.log(`❌ ${key}: MISSING`);
        hasErrors = true;
        continue;
      }
      
      const issues = [];
      
      // Check type
      if (actual.type !== expected.type) {
        issues.push(`type=${actual.type} (expected ${expected.type})`);
      }
      
      // Check array
      if (actual.array !== expected.array) {
        issues.push(`array=${actual.array} (expected ${expected.array})`);
        if ((key === 'oldRoles' || key === 'newRoles') && actual.array === false) {
          console.log(`\n⚠️  CRITICAL: "${key}" is configured as String but MUST be String Array!`);
          console.log(`   This will cause errors when logging role changes.`);
          console.log(`   Fix: Delete the "${key}" attribute and recreate it with Array=Yes\n`);
        }
      }
      
      // Check required
      if (actual.required !== expected.required) {
        issues.push(`required=${actual.required} (expected ${expected.required})`);
      }
      
      if (issues.length > 0) {
        console.log(`⚠️  ${key}: ${issues.join(', ')}`);
        hasErrors = true;
      } else {
        console.log(`✅ ${key}: OK`);
      }
    }
    
    console.log('\n' + '─'.repeat(60));
    return hasErrors;
    
  } catch (err) {
    console.error('❌ Error checking roleChanges collection:', err.message);
    if (err.code === 404) {
      console.error('   Collection not found. Please create the roleChanges collection first.');
    }
    return true;
  }
}

async function checkAttributeTypes() {
  const usersErrors = await checkUsersCollection();
  const roleChangesErrors = await checkRoleChangesCollection();
  
  const hasErrors = usersErrors || roleChangesErrors;
  
  if (hasErrors) {
    console.log('\n❌ Some attributes have incorrect configuration.');
    console.log('   Please fix the issues above in Appwrite Console.');
    console.log('   See MANUAL_ATTRIBUTE_SETUP.md for correct configuration.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All attributes are configured correctly!\n');
  }
}

checkAttributeTypes();

