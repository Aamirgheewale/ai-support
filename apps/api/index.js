require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const {
  awDatabases,
  geminiClient,
  chatService,
  config
} = require('./config/clients');

const {
  MASTER_KEY_BASE64,
  ENCRYPTION_ENABLED
} = config;

// Services
const initSocketHandlers = require('./sockets/socketHandler');
const dashboardRoutes = require('./routes/dashboardRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const userRoutes = require('./routes/userRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const themeRoutes = require('./routes/themeRoutes');
const cannedResponseRoutes = require('./routes/cannedResponseRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const systemRoutes = require('./routes/systemRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Security headers (helmet)
let helmet = null;
try {
  helmet = require('helmet');
  console.log('✅ Helmet security middleware loaded');
} catch (e) {
  console.warn('⚠️  Helmet not available (run: pnpm add helmet):', e?.message || e);
}

const app = express();

// Trust the first proxy so secure cookies & protocol detection work correctly on Railway/Heroku
app.set('trust proxy', 1);

// Security headers (helmet)
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for Socket.IO compatibility
    crossOriginEmbedderPolicy: false
  }));
  console.log('✅ Security headers enabled (helmet)');
}

const allowedOrigins = [
  'https://ai-support-admin.vercel.app',
  'https://ai-support-widget-one.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://outstanding-vitality-production-c38b.up.railway.app',
  'https://charming-nourishment-production.up.railway.app',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Mount Routes
app.use('/', authRoutes);
app.use('/admin', dashboardRoutes);
app.use('/me', userRoutes); // User Management (Sessions, etc)
app.use('/api/sessions', sessionRoutes);
app.use('/admin/sessions', sessionRoutes); // Legacy/Admin path support
app.use('/api/tickets', ticketRoutes);
app.use('/api/canned-responses', cannedResponseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/', systemRoutes); // Mounts / and /health/db, and legacy paths
app.use('/', themeRoutes);
app.use('/api/admin', adminRoutes);

// Socket.IO Setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});
app.set('io', io);

// Initialize Socket Handlers
initSocketHandlers(io);

// Pass IO to Chat Service for real-time notifications
if (chatService) {
  chatService.setIo(io);
  console.log('✅ Socket.IO instance injected into Chat Service');
}

const PORT = process.env.PORT || 4000;
const FORCE_TLS = process.env.FORCE_TLS === 'true';

server.listen(PORT, () => {
  console.log(`🚀 Socket.IO API server listening on port ${PORT}`);
  console.log(`📋 Environment: Gemini=${geminiClient ? '✅' : '❌'}, Appwrite=${awDatabases ? '✅' : '❌'}, Encryption=${ENCRYPTION_ENABLED ? '✅' : '❌'}`);

  // TLS check
  if (FORCE_TLS) {
    console.log('🔒 TLS enforcement enabled (FORCE_TLS=true)');
    console.log('   ⚠️  Ensure server is behind TLS proxy (nginx, cloudflare, etc.)');
  } else {
    console.warn('⚠️  TLS not enforced (set FORCE_TLS=true in production)');
    console.warn('   In production, use HTTPS/WSS and set FORCE_TLS=true');
  }

  // Security recommendations
  if (!ENCRYPTION_ENABLED) {
    console.warn('⚠️  Encryption disabled - sensitive data stored in plaintext');
    console.warn('   Set MASTER_KEY_BASE64 to enable encryption');
  }

  if (MASTER_KEY_BASE64 && !process.env.NODE_ENV?.includes('prod')) {
    console.warn('⚠️  PRODUCTION: Use KMS (AWS KMS/GCP KMS/HashiCorp Vault) instead of plaintext MASTER_KEY_BASE64');
  }
});
