// Test Gemini API key directly
require('dotenv').config();

(async () => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not found in .env');
      process.exit(1);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    console.log('🔑 Testing Gemini API Key...\n');
    console.log(`   Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`   Length: ${apiKey.length} characters\n`);

    // Test with direct REST API call
    const fetch = require('node-fetch');
    
    console.log('📡 Testing API access with REST call...\n');
    
    // Try to list available models first
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      console.log('   Fetching available models...');
      const listResponse = await fetch(listUrl);
      const listData = await listResponse.json();
      
      if (listResponse.ok && listData.models) {
        console.log(`\n✅ API Key is valid! Found ${listData.models.length} available model(s):\n`);
        listData.models.slice(0, 10).forEach(model => {
          console.log(`   - ${model.name}`);
        });
        
        // Find models that support generateContent
        const generateContentModels = listData.models.filter(m => 
          m.supportedGenerationMethods && 
          m.supportedGenerationMethods.includes('generateContent')
        );
        
        if (generateContentModels.length > 0) {
          console.log(`\n✅ Models supporting generateContent (${generateContentModels.length}):\n`);
          generateContentModels.slice(0, 5).forEach(model => {
            const modelId = model.name.replace('models/', '');
            console.log(`   - ${modelId}`);
          });
          
          // Test with the first available model
          const testModel = generateContentModels[0].name.replace('models/', '');
          console.log(`\n🧪 Testing generateContent with model: ${testModel}...\n`);
          
          const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`;
          const generateResponse = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: 'Say "test" in one word.' }]
              }]
            })
          });
          
          const generateData = await generateResponse.json();
          
          if (generateResponse.ok && generateData.candidates && generateData.candidates[0]) {
            const responseText = generateData.candidates[0].content.parts[0].text;
            console.log(`✅ SUCCESS! Model ${testModel} responded: "${responseText}"\n`);
            console.log(`💡 Add this to your .env file:`);
            console.log(`   GEMINI_MODEL=${testModel}\n`);
          } else {
            console.log(`❌ generateContent failed:`, generateData.error || generateData);
          }
        } else {
          console.log('\n⚠️  No models found that support generateContent');
        }
      } else {
        console.log('❌ Failed to list models:', listData.error || listData);
        if (listData.error) {
          console.log(`   Code: ${listData.error.code}`);
          console.log(`   Message: ${listData.error.message}`);
          if (listData.error.status === 'PERMISSION_DENIED') {
            console.log('\n💡 This usually means:');
            console.log('   1. Billing is not set up (see "Set up billing" in Google AI Studio)');
            console.log('   2. API key restrictions are blocking access');
            console.log('   3. Generative Language API is not enabled');
          }
        }
      }
    } catch (fetchErr) {
      console.error('❌ Fetch error:', fetchErr.message);
      console.log('\n💡 Make sure you have node-fetch installed:');
      console.log('   pnpm add node-fetch@2');
    }

  } catch (err) {
    console.error('\n❌ Error:', err?.message || err);
    process.exit(1);
  }
})();

