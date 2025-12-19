import express from 'express';
import path from 'path';
import fs from 'fs'; // Import FS to check files
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- 🔍 DEBUG SECTION: DIAGNOSE THE FILE SYSTEM 🔍 ---
console.log("🚀 SERVER STARTING...");
console.log("📂 Current Directory (__dirname):", __dirname);

const distPath = path.join(__dirname, 'dist');
console.log("📂 Target Dist Path:", distPath);

if (fs.existsSync(distPath)) {
    console.log("✅ Dist folder exists. Contents:", fs.readdirSync(distPath));
} else {
    console.error("❌ CRITICAL ERROR: Dist folder is MISSING at runtime!");
}

const embedFile = path.join(distPath, 'embed.js');
if (fs.existsSync(embedFile)) {
    console.log("✅ embed.js found at:", embedFile);
} else {
    console.error("❌ CRITICAL ERROR: embed.js is MISSING from dist folder!");
}
// -----------------------------------------------------

// 1. Enable CORS for ALL requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

// 2. Explicitly handle embed.js route
app.get('/embed.js', (req, res) => {
  const fileToSend = path.join(__dirname, 'dist', 'embed.js');
  
  // Check existence before sending to avoid generic errors
  if (!fs.existsSync(fileToSend)) {
      console.error(`⚠️ Request for /embed.js failed. File not found at: ${fileToSend}`);
      return res.status(404).send('// Error: embed.js not found on server filesystem.');
  }

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.sendFile(fileToSend, (err) => {
    if (err) {
      console.error('Error serving embed.js:', err);
      res.status(500).send('// Error serving file');
    }
  });
});

// 3. Serve Static Files
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

// 4. Handle SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Widget Server running on port ${PORT}`);
});