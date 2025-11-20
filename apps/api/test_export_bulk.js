require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.SERVER_URL || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-secret-change-me';
const TEST_SESSION_IDS = process.argv.slice(2).length > 0 
  ? process.argv.slice(2) 
  : ['test123', 'test456'];

async function testExportBulk() {
  console.log('🧪 Testing Bulk Session Export');
  console.log('============================================================');
  console.log(`Server: ${API_BASE}`);
  console.log(`Sessions: ${TEST_SESSION_IDS.join(', ')}`);
  console.log('');

  // Test JSON bulk export
  console.log('📝 Testing JSON bulk export...');
  try {
    const jsonRes = await fetch(`${API_BASE}/admin/sessions/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionIds: TEST_SESSION_IDS,
        format: 'json'
      })
    });

    if (!jsonRes.ok) {
      const errorText = await jsonRes.text();
      console.error(`❌ JSON bulk export failed: ${jsonRes.status} ${jsonRes.statusText}`);
      console.error(`   Response: ${errorText}`);
    } else {
      const contentType = jsonRes.headers.get('content-type');
      const contentDisposition = jsonRes.headers.get('content-disposition');
      
      console.log(`✅ Status: ${jsonRes.status}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Content-Disposition: ${contentDisposition}`);

      const jsonData = await jsonRes.json();
      const filename = `test_bulk_export_${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2));
      console.log(`✅ JSON bulk export saved to: ${filename}`);
      console.log(`   Sessions: ${Object.keys(jsonData.sessions || {}).length}`);
    }
  } catch (err) {
    console.error('❌ JSON bulk export error:', err.message);
  }

  console.log('');

  // Test CSV bulk export (ZIP)
  console.log('📝 Testing CSV bulk export (ZIP)...');
  try {
    const csvRes = await fetch(`${API_BASE}/admin/sessions/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionIds: TEST_SESSION_IDS,
        format: 'csv'
      })
    });

    if (!csvRes.ok) {
      const errorText = await csvRes.text();
      console.error(`❌ CSV bulk export failed: ${csvRes.status} ${csvRes.statusText}`);
      console.error(`   Response: ${errorText}`);
    } else {
      const contentType = csvRes.headers.get('content-type');
      const contentDisposition = csvRes.headers.get('content-disposition');
      
      console.log(`✅ Status: ${csvRes.status}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Content-Disposition: ${contentDisposition}`);

      const buffer = await csvRes.arrayBuffer();
      const filename = `test_bulk_export_${Date.now()}.zip`;
      fs.writeFileSync(filename, Buffer.from(buffer));
      console.log(`✅ CSV bulk export (ZIP) saved to: ${filename}`);
      console.log(`   Size: ${buffer.byteLength} bytes`);
      
      // Verify it's a valid ZIP
      const zipHeader = Buffer.from(buffer).slice(0, 2);
      if (zipHeader[0] === 0x50 && zipHeader[1] === 0x4B) {
        console.log(`   ✅ Valid ZIP file (PK header found)`);
      } else {
        console.log(`   ⚠️  Warning: May not be a valid ZIP file`);
      }
    }
  } catch (err) {
    console.error('❌ CSV bulk export error:', err.message);
  }

  console.log('');
  console.log('✅ Test completed!');
}

// Use node-fetch if available, otherwise use built-in fetch (Node 18+)
if (typeof fetch === 'undefined') {
  const fetch = require('node-fetch');
  testExportBulk();
} else {
  testExportBulk();
}

