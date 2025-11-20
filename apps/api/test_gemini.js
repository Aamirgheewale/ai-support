// apps/api/test_gemini.js — Smoke test for Gemini API
require('dotenv').config();

(async () => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY missing — add to apps/api/.env');
      console.log('   Example: GEMINI_API_KEY=your-api-key-here');
      process.exit(1);
    }

    console.log('📦 Loading @google/genai SDK...');
    const genai = require('@google/genai');

    console.log('🔑 Instantiating Gemini client...');
    const client = new genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    console.log(`🤖 Testing model: ${model}`);
    console.log('📤 Calling Gemini API...\n');

    // Call Gemini
    const response = await client.models.generateContent({
      model: model,
      contents: 'Say hello in one short sentence.'
    });

    // Extract response text robustly
    let text = null;
    if (typeof response?.text === 'function') {
      text = response.text();
    } else if (response?.outputs?.[0]?.content?.[0]?.text) {
      text = response.outputs[0].content[0].text;
    } else if (response?.text) {
      text = response.text;
    } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = response.candidates[0].content.parts[0].text;
    } else {
      console.warn('⚠️  Unexpected response shape:', JSON.stringify(response, null, 2).substring(0, 500));
      text = JSON.stringify(response).substring(0, 200);
    }

    console.log('✅ Gemini reply:', String(text).substring(0, 400));
    console.log('\n🎉 Test passed! Gemini API is working correctly.');
    
    // Optionally list available models
    try {
      console.log('\n📋 Checking available models...');
      const models = await client.models.list();
      if (models && models.length > 0) {
        console.log(`   Found ${models.length} model(s):`);
        models.slice(0, 5).forEach(m => {
          console.log(`   - ${m.name || m.id || JSON.stringify(m).substring(0, 50)}`);
        });
      }
    } catch (listErr) {
      console.log('   (Model listing not available or failed)');
    }
    
  } catch (e) {
    console.error('\n❌ Gemini test error:', e?.message || e);
    if (e?.code) console.error('   Code:', e.code);
    if (e?.status) console.error('   Status:', e.status);
    if (e?.response) {
      console.error('   Response:', JSON.stringify(e.response, null, 2).substring(0, 500));
    }
    
    // If model not found, suggest checking available models
    if (e?.code === 404 || e?.message?.includes('not found') || e?.message?.includes('404')) {
      console.log('\n💡 Tip: The model might not be available. Try:');
      console.log('   - gemini-2.0-flash-exp');
      console.log('   - gemini-1.5-pro');
      console.log('   - gemini-1.5-flash');
      console.log('   Or check your Google Cloud Console for available models.');
    }
    
    process.exit(1);
  }
})();
