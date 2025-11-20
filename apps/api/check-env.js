// Quick script to check if all required env vars are set
require('dotenv').config();

const required = {
  'GEMINI_API_KEY': 'Required for AI responses',
  'ADMIN_SHARED_SECRET': 'Required for admin endpoints'
};

const optional = {
  'PORT': 'Server port (default: 4000)',
  'GEMINI_MODEL': 'Gemini model name (default: gemini-1.5-flash)',
  'REDIS_URL': 'Redis connection URL (set to "disabled" to skip)',
  'APPWRITE_ENDPOINT': 'Appwrite endpoint URL',
  'APPWRITE_PROJECT_ID': 'Appwrite project ID',
  'APPWRITE_API_KEY': 'Appwrite API key',
  'APPWRITE_DATABASE_ID': 'Appwrite database ID',
  'APPWRITE_SESSIONS_COLLECTION_ID': 'Appwrite sessions collection ID',
  'APPWRITE_MESSAGES_COLLECTION_ID': 'Appwrite messages collection ID'
};

console.log('📋 Environment Variables Check\n');

let hasErrors = false;

// Check required
console.log('Required Variables:');
for (const [key, desc] of Object.entries(required)) {
  const value = process.env[key];
  if (value) {
    console.log(`  ✅ ${key}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`  ❌ ${key}: MISSING - ${desc}`);
    hasErrors = true;
  }
}

console.log('\nOptional Variables:');
for (const [key, desc] of Object.entries(optional)) {
  const value = process.env[key];
  if (value) {
    const displayValue = key.includes('KEY') || key.includes('SECRET') 
      ? `${value.substring(0, 10)}...` 
      : value;
    console.log(`  ✅ ${key}: ${displayValue}`);
  } else {
    console.log(`  ⚠️  ${key}: not set - ${desc}`);
  }
}

console.log('\n📊 Summary:');
const totalVars = Object.keys(required).length + Object.keys(optional).length;
const setVars = [...Object.keys(required), ...Object.keys(optional)].filter(
  key => process.env[key]
).length;

console.log(`  Total variables: ${totalVars}`);
console.log(`  Set variables: ${setVars}`);
console.log(`  Missing variables: ${totalVars - setVars}`);

if (hasErrors) {
  console.log('\n❌ Some required variables are missing!');
  process.exit(1);
} else {
  console.log('\n✅ All required variables are set!');
}

