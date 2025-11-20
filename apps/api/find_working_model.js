// Script to find a working Gemini model for your API key
require('dotenv').config();

(async () => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY missing');
      process.exit(1);
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    console.log('🔍 Testing Gemini models to find one that works...\n');

    // Comprehensive list of model names to try
    const modelsToTry = [
      'gemini-1.5-flash-002',
      'gemini-1.5-pro-002',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-1.0-pro',
      'gemini-2.0-flash-exp',
      'gemini-ultra'
    ];

    let workingModel = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Testing: ${modelName}...`);
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "test"');
        const response = await result.response;
        const text = response.text();
        
        if (text && text.toLowerCase().includes('test')) {
          console.log(`  ✅ WORKS! Response: ${text.substring(0, 50)}...\n`);
          workingModel = modelName;
          break;
        }
      } catch (err) {
        const is404 = err?.status === 404 || err?.message?.includes('404') || err?.message?.includes('not found');
        if (is404) {
          console.log(`  ❌ Not available (404)\n`);
        } else {
          console.log(`  ⚠️  Error: ${err?.message?.substring(0, 100)}\n`);
        }
      }
    }

    if (workingModel) {
      console.log(`\n✅ Found working model: ${workingModel}`);
      console.log(`\n💡 Add this to your .env file:`);
      console.log(`   GEMINI_MODEL=${workingModel}`);
    } else {
      console.log('\n❌ No working models found. Possible issues:');
      console.log('   1. Your API key might not have access to Gemini models');
      console.log('   2. Check your Google Cloud Console API quotas');
      console.log('   3. Verify your API key is correct');
      console.log('   4. Try getting a new API key from: https://aistudio.google.com/app/apikey');
      console.log('\n   Make sure you enable "Generative Language API" in Google Cloud Console');
    }

  } catch (err) {
    console.error('\n❌ Error:', err?.message || err);
    process.exit(1);
  }
})();

