import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Enable CORS for ALL requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Cross-Origin-Resource-Policy", "cross-origin"); // CRITICAL for embed.js
  next();
});

// 2. Explicitly handle embed.js route FIRST (ensures it's always served correctly with CORS)
app.get('/embed.js', (req, res) => {
  const embedPath = path.join(__dirname, 'dist', 'embed.js');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(embedPath, (err) => {
    if (err) {
      console.error('Error serving embed.js:', err);
      res.status(404).send('// embed.js not found. Make sure you have built the project.');
    }
  });
});

// 3. Serve Static Files (from 'dist' folder) - with CORS headers for all files
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    // Ensure all JavaScript files are served with proper CORS headers
    if (filePath.endsWith('.js')) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

// 4. Handle SPA Fallback (return index.html for unknown routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Widget Server running on port ${PORT}`);
});

