import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Default to 3000 if PORT is missing, but Railway ALWAYS provides PORT
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
    console.log("✅ VERIFIED: embed.js exists at:", embedFile);
} else {
    console.error("❌ CRITICAL ERROR: embed.js is MISSING from dist folder!");
}
// -----------------------------------------------------

// 1. TRAFFIC LOGGER (New!) - Must be FIRST
app.use((req, res, next) => {
    console.log(`🔔 INCOMING REQUEST: ${req.method} ${req.url}`);
    next();
});

// 2. Enable CORS & Security Headers for ALL requests
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
});

// 3. Explicitly handle embed.js route
app.get('/embed.js', (req, res) => {
    console.log("👉 Route MATCHED: /embed.js"); // Log when we try to serve it
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
        } else {
            console.log("✅ Successfully sent embed.js");
        }
    });
});

// 4. Serve Static Files
app.use(express.static(path.join(__dirname, 'dist'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
    }
}));

// 5. Handle SPA Fallback
app.get('*', (req, res) => {
    console.log(`Fallback: Serving index.html for ${req.url}`);
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => { // Bind to 0.0.0.0 to be safe
    console.log(`✅ Widget Server listening on PORT ${PORT}`);
});