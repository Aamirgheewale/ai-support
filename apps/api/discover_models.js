// Script to discover available Gemini models
require('dotenv').config();

(async () => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY missing');
      process.exit(1);
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    console.log('🔍 Discovering available Gemini models...\n');

    // List of model names to try
    const modelsToTry = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-ultra',
      'gemini-ultra-latest'
    ];

    const workingModels = [];
    const failedModels = [];

    for (const modelName of modelsToTry) {
      try {
        console.log(`Testing: ${modelName}...`);
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "test"');
        const response = await result.response;
        const text = response.text();
        
        if (text) {
          console.log(`  ✅ WORKS! Response: ${text.substring(0, 50)}...\n`);
          workingModels.push(modelName);
        }
      } catch (err) {
        const is404 = err?.status === 404 || err?.message?.includes('404') || err?.message?.includes('not found');
        if (is404) {
          console.log(`  ❌ Not available (404)\n`);
          failedModels.push({ name: modelName, error: '404 Not Found' });
        } else {
          console.log(`  ⚠️  Error: ${err?.message?.substring(0, 100)}\n`);
          failedModels.push({ name: modelName, error: err?.message });
        }
      }
    }

    console.log('\n📊 Results:');
    console.log(`\n✅ Working Models (${workingModels.length}):`);
    if (workingModels.length > 0) {
      workingModels.forEach(m => console.log(`   - ${m}`));
      console.log(`\n💡 Set GEMINI_MODEL=${workingModels[0]} in your .env file`);
    } else {
      console.log('   None found. All models returned errors.');
      console.log('\n⚠️  Possible issues:');
      console.log('   1. Your API key might not have access to Gemini models');
      console.log('   2. Check your Google Cloud Console API quotas');
      console.log('   3. Verify your API key is correct');
      console.log('   4. Try getting a new API key from https://aistudio.google.com/app/apikey');
    }

    console.log(`\n❌ Failed Models (${failedModels.length}):`);
    failedModels.slice(0, 5).forEach(m => {
      console.log(`   - ${m.name}: ${m.error.substring(0, 80)}`);
    });

  } catch (err) {
    console.error('❌ Error:', err?.message || err);
    process.exit(1);
  }
})();

