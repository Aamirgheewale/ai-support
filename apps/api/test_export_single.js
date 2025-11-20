require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.SERVER_URL || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-secret-change-me';
const TEST_SESSION_ID = process.argv[2] || 'test123';

async function testExportSingle() {
  console.log('🧪 Testing Single Session Export');
  console.log('============================================================');
  console.log(`Server: ${API_BASE}`);
  console.log(`Session: ${TEST_SESSION_ID}`);
  console.log('');

  // Test JSON export
  console.log('📝 Testing JSON export...');
  try {
    const jsonRes = await fetch(`${API_BASE}/admin/sessions/${TEST_SESSION_ID}/export?format=json`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`
      }
    });

    if (!jsonRes.ok) {
      const errorText = await jsonRes.text();
      console.error(`❌ JSON export failed: ${jsonRes.status} ${jsonRes.statusText}`);
      console.error(`   Response: ${errorText}`);
      return;
    }

    const contentType = jsonRes.headers.get('content-type');
    const contentDisposition = jsonRes.headers.get('content-disposition');
    
    console.log(`✅ Status: ${jsonRes.status}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Disposition: ${contentDisposition}`);

    const jsonData = await jsonRes.json();
    const filename = `test_export_${TEST_SESSION_ID}_${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2));
    console.log(`✅ JSON export saved to: ${filename}`);
    console.log(`   Messages: ${Array.isArray(jsonData) ? jsonData.length : 'N/A'}`);
  } catch (err) {
    console.error('❌ JSON export error:', err.message);
  }

  console.log('');

  // Test CSV export
  console.log('📝 Testing CSV export...');
  try {
    const csvRes = await fetch(`${API_BASE}/admin/sessions/${TEST_SESSION_ID}/export?format=csv`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`
      }
    });

    if (!csvRes.ok) {
      const errorText = await csvRes.text();
      console.error(`❌ CSV export failed: ${csvRes.status} ${csvRes.statusText}`);
      console.error(`   Response: ${errorText}`);
      return;
    }

    const contentType = csvRes.headers.get('content-type');
    const contentDisposition = csvRes.headers.get('content-disposition');
    
    console.log(`✅ Status: ${csvRes.status}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Disposition: ${contentDisposition}`);

    const csvData = await csvRes.text();
    const filename = `test_export_${TEST_SESSION_ID}_${Date.now()}.csv`;
    fs.writeFileSync(filename, csvData);
    console.log(`✅ CSV export saved to: ${filename}`);
    console.log(`   Size: ${csvData.length} bytes`);
    console.log(`   Lines: ${csvData.split('\n').length}`);
  } catch (err) {
    console.error('❌ CSV export error:', err.message);
  }

  console.log('');
  console.log('✅ Test completed!');
}

// Use node-fetch if available, otherwise use built-in fetch (Node 18+)
if (typeof fetch === 'undefined') {
  const fetch = require('node-fetch');
  testExportSingle();
} else {
  testExportSingle();
}

