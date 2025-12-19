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

// 2. Serve Static Files (from 'dist' folder)
app.use(express.static(path.join(__dirname, 'dist')));

// 3. Handle SPA Fallback (return index.html for unknown routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Widget Server running on port ${PORT}`);
});

