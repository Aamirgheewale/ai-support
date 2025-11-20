// Script to check environment variables (without exposing secrets)
require('dotenv').config();

console.log('📋 Environment Variables Check\n');
console.log('=' .repeat(50));

// Check required variables
const checks = {
  'GEMINI_API_KEY': {
    required: true,
    description: 'Gemini API Key (Generative Language API Key)',
    value: process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...${process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 4)}` : 'NOT SET'
  },
  'GEMINI_MODEL': {
    required: false,
    description: 'Gemini Model Name',
    value: process.env.GEMINI_MODEL || 'NOT SET (will use default)'
  },
  'APPWRITE_ENDPOINT': {
    required: true,
    description: 'Appwrite Endpoint URL',
    value: process.env.APPWRITE_ENDPOINT || 'NOT SET'
  },
  'APPWRITE_PROJECT_ID': {
    required: true,
    description: 'Appwrite Project ID',
    value: process.env.APPWRITE_PROJECT_ID ? `${process.env.APPWRITE_PROJECT_ID.substring(0, 8)}...` : 'NOT SET'
  },
  'APPWRITE_API_KEY': {
    required: true,
    description: 'Appwrite API Key',
    value: process.env.APPWRITE_API_KEY ? `${process.env.APPWRITE_API_KEY.substring(0, 10)}...` : 'NOT SET'
  },
  'APPWRITE_DATABASE_ID': {
    required: true,
    description: 'Appwrite Database ID',
    value: process.env.APPWRITE_DATABASE_ID || 'NOT SET'
  },
  'APPWRITE_SESSIONS_COLLECTION_ID': {
    required: true,
    description: 'Appwrite Sessions Collection ID',
    value: process.env.APPWRITE_SESSIONS_COLLECTION_ID || 'NOT SET'
  },
  'APPWRITE_MESSAGES_COLLECTION_ID': {
    required: true,
    description: 'Appwrite Messages Collection ID',
    value: process.env.APPWRITE_MESSAGES_COLLECTION_ID || 'NOT SET'
  },
  'ADMIN_SHARED_SECRET': {
    required: true,
    description: 'Admin Shared Secret',
    value: process.env.ADMIN_SHARED_SECRET ? 'SET (hidden)' : 'NOT SET'
  },
  'PORT': {
    required: false,
    description: 'Server Port',
    value: process.env.PORT || '4000 (default)'
  }
};

let hasErrors = false;
let hasWarnings = false;

console.log('\n✅ Required Variables:');
for (const [key, info] of Object.entries(checks)) {
  if (info.required) {
    const isSet = process.env[key] && process.env[key] !== '';
    const status = isSet ? '✅' : '❌';
    console.log(`  ${status} ${key}: ${info.value}`);
    if (!isSet) {
      hasErrors = true;
      console.log(`     ⚠️  ${info.description} is required!`);
    }
  }
}

console.log('\n📝 Optional Variables:');
for (const [key, info] of Object.entries(checks)) {
  if (!info.required) {
    const isSet = process.env[key] && process.env[key] !== '';
    const status = isSet ? '✅' : '⚠️ ';
    console.log(`  ${status} ${key}: ${info.value}`);
    if (!isSet && key === 'GEMINI_MODEL') {
      console.log(`     ℹ️  Will use default: gemini-1.5-flash`);
    }
  }
}

console.log('\n' + '='.repeat(50));

// Validate GEMINI_API_KEY format
if (process.env.GEMINI_API_KEY) {
  const key = process.env.GEMINI_API_KEY;
  console.log('\n🔑 Gemini API Key Validation:');
  console.log(`   Length: ${key.length} characters`);
  
  if (key.length < 20) {
    console.log('   ⚠️  Warning: API key seems too short');
    hasWarnings = true;
  } else if (key.length > 200) {
    console.log('   ⚠️  Warning: API key seems too long');
    hasWarnings = true;
  } else {
    console.log('   ✅ Length looks correct');
  }
  
  // Check if it starts with common patterns
  if (key.startsWith('AIza')) {
    console.log('   ✅ Format looks correct (starts with AIza)');
  } else {
    console.log('   ⚠️  Note: API key format might be different');
    hasWarnings = true;
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 Summary:');

const totalRequired = Object.values(checks).filter(c => c.required).length;
const setRequired = Object.entries(checks)
  .filter(([key, info]) => info.required && process.env[key] && process.env[key] !== '')
  .length;

console.log(`   Required variables set: ${setRequired}/${totalRequired}`);

if (hasErrors) {
  console.log('\n❌ Some required variables are missing!');
  console.log('   Please check your .env file and ensure all required variables are set.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\n⚠️  All required variables are set, but there are some warnings.');
  console.log('   Review the output above.');
  process.exit(0);
} else {
  console.log('\n✅ All required variables are set correctly!');
  console.log('\n💡 Next steps:');
  console.log('   1. Run: node find_working_model.js (to find a working Gemini model)');
  console.log('   2. Run: node index.js (to start the server)');
  process.exit(0);
}

