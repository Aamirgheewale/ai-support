# AI Customer Support Chat System

A production-ready, full-stack AI-powered customer support chat system with real-time messaging, agent routing, analytics dashboard, and comprehensive admin features.

## 🚀 Features

### Core Features
- **Real-time Chat Widget** - Embeddable chat widget with customizable themes
- **AI-Powered Responses** - Google Gemini AI integration with intelligent fallback
- **Agent Routing** - Seamless handoff from AI to human agents
- **Session Management** - Complete conversation history and session tracking
- **Analytics Dashboard** - Comprehensive metrics, charts, and performance insights
- **Role-Based Access Control (RBAC)** - Multi-level user permissions (super_admin, admin, agent, viewer)
- **Accuracy Logging** - Track AI response quality with feedback system
- **Export Functionality** - Export conversations and analytics data (CSV/JSON)
- **Server-Side Pagination** - Efficient data loading for large datasets
- **Encryption at Rest** - AES-256-GCM encryption for sensitive data
- **TLS Enforcement** - Secure communication with HTTPS/WSS checks

### Admin Features
- **Session Management** - View, filter, and manage all chat sessions
- **Agent Assignment** - Assign agents to conversations and track performance
- **Analytics Dashboard** - Real-time metrics, charts, and KPIs
- **Accuracy Monitoring** - Track AI response quality and provide feedback
- **User Management** - Create, update, and manage users with role assignment
- **Encryption Management** - Monitor and manage encryption status
- **Export & Download** - Bulk export conversations and analytics data

## 📁 Project Structure

```
ai-support/
├── apps/
│   ├── api/              # Backend API server (Node.js/Express)
│   │   ├── index.js      # Main server file
│   │   ├── lib/          # Utility libraries (encryption, pagination)
│   │   └── migrations/   # Database migration scripts
│   ├── admin/            # Admin dashboard (React/TypeScript)
│   │   └── src/
│   │       ├── pages/    # Page components
│   │       ├── components/ # Reusable components
│   │       └── hooks/    # Custom React hooks
│   └── widget/           # Chat widget (React/TypeScript)
│       └── src/
│           └── components/ # Widget components
├── COMPLETION_STATUS.md  # Feature completion tracking
└── README.md            # This file
```

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **Socket.IO** for real-time communication
- **Appwrite** for database and storage
- **Google Gemini AI** for intelligent responses
- **Helmet** for security middleware
- **AES-256-GCM** for encryption

### Frontend
- **React 18+** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Socket.IO Client** for real-time updates
- **React Router** for navigation

## 📋 Prerequisites

- **Node.js** 18+ and npm/pnpm
- **Appwrite** instance (cloud or self-hosted)
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/app/apikey))
- **Redis** (optional, for caching)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-support
   ```

2. **Install dependencies for each app**
   ```bash
   # Backend API
   cd apps/api
   pnpm install

   # Admin Dashboard
   cd ../admin
   pnpm install

   # Chat Widget
   cd ../widget
   pnpm install
   ```

3. **Set up Appwrite**
   - Create a new Appwrite project
   - Create a database
   - Create the following collections/tables:
     - `sessions` - Chat sessions
     - `messages` - Chat messages
     - `users` - User accounts
     - `ai_accuracy` - AI response accuracy logs
     - `encryption_audit` - Encryption audit logs
     - `roleChanges` - Role change history

4. **Configure environment variables**

   **Backend (`apps/api/.env`):**
   ```env
   # Server
   PORT=4000
   NODE_ENV=production

   # Appwrite
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   APPWRITE_PROJECT_ID=your_project_id
   APPWRITE_API_KEY=your_api_key
   APPWRITE_DATABASE_ID=your_database_id
   APPWRITE_SESSIONS_COLLECTION_ID=sessions
   APPWRITE_MESSAGES_COLLECTION_ID=messages
   APPWRITE_USERS_COLLECTION_ID=users
   APPWRITE_AI_ACCURACY_COLLECTION_ID=ai_accuracy

   # Google Gemini AI
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.0-flash

   # Security
   ADMIN_SHARED_SECRET=your_secure_secret_key
   MASTER_KEY=your_32_byte_encryption_key

   # Encryption (optional)
   ENCRYPT_ENABLED=true
   REDACT_PII=false

   # Redis (optional)
   REDIS_URL=redis://localhost:6379
   ```

   **Admin Dashboard (`apps/admin/.env`):**
   ```env
   VITE_API_BASE=http://localhost:4000
   VITE_ADMIN_SECRET=your_secure_secret_key
   ```

   **Widget (`apps/widget/.env`):**
   ```env
   VITE_API_BASE=http://localhost:4000
   VITE_SOCKET_URL=http://localhost:4000
   ```

## 🚀 Running the Application

### Development Mode

1. **Start the backend API**
   ```bash
   cd apps/api
   node index.js
   ```
   The API server will run on `http://localhost:4000`

2. **Start the admin dashboard**
   ```bash
   cd apps/admin
   pnpm dev
   ```
   The admin dashboard will run on `http://localhost:5173`

3. **Start the widget (for development)**
   ```bash
   cd apps/widget
   pnpm dev
   ```
   The widget will run on `http://localhost:5174`

### Production Build

1. **Build the admin dashboard**
   ```bash
   cd apps/admin
   pnpm build
   ```

2. **Build the widget**
   ```bash
   cd apps/widget
   pnpm build
   ```

3. **Start the backend API**
   ```bash
   cd apps/api
   node index.js
   ```

## 📡 API Endpoints

### Authentication
- `POST /auth/login` - Admin login
- `GET /me` - Get current user info

### Sessions
- `GET /admin/sessions` - List sessions (paginated)
- `GET /admin/sessions/:sessionId` - Get session details
- `GET /admin/sessions/:sessionId/messages` - Get session messages (paginated)
- `PUT /admin/sessions/:sessionId/assign` - Assign agent to session
- `PUT /admin/sessions/:sessionId/close` - Close session
- `POST /admin/sessions/export` - Export sessions (CSV/JSON)

### Analytics
- `GET /admin/analytics/overview` - Get analytics overview
- `GET /admin/analytics/messages-over-time` - Messages over time chart data
- `GET /admin/analytics/confidence-histogram` - Confidence score distribution
- `GET /admin/analytics/response-times` - Response time metrics
- `GET /admin/analytics/agent-performance` - Agent performance metrics

### Accuracy
- `GET /admin/accuracy` - List accuracy records (paginated)
- `GET /admin/accuracy/stats` - Accuracy statistics
- `GET /admin/accuracy/:accuracyId` - Get accuracy record details
- `POST /admin/accuracy/:accuracyId/feedback` - Submit feedback
- `POST /admin/accuracy/:accuracyId/evaluate` - Admin evaluation

### Users
- `GET /admin/users` - List users (paginated)
- `POST /admin/users` - Create user (super_admin only)
- `PUT /admin/users/:userId` - Update user
- `DELETE /admin/users/:userId` - Delete user
- `PUT /admin/users/:userId/roles` - Update user roles

### Encryption
- `GET /admin/encryption/status` - Get encryption status
- `POST /admin/encryption/reencrypt` - Re-encrypt data
- `POST /admin/encryption/cleanup-plaintext` - Cleanup plaintext data
- `GET /admin/encryption/audit` - Get encryption audit logs

## 🔐 Security Features

### Encryption
- **Envelope Encryption** - AES-256-GCM with master key derivation
- **Field-Level Encryption** - Encrypt sensitive message and metadata fields
- **Key Rotation** - Support for rotating master keys
- **Migration Tooling** - Scripts for encrypting existing data

### Authentication & Authorization
- **Role-Based Access Control (RBAC)** - Four role levels:
  - `super_admin` - Full system access
  - `admin` - Administrative access
  - `agent` - Agent access for handling conversations
  - `viewer` - Read-only access
- **Token-Based Authentication** - Secure token validation
- **TLS Enforcement** - HTTPS/WSS checks and security headers

## 📊 Database Schema

### Sessions Collection
- `sessionId` (string) - Unique session identifier
- `status` (string) - active, agent_assigned, closed, needs_human
- `assignedAgentId` (string) - Assigned agent ID
- `userMeta` (string) - JSON metadata
- `createdAt` (datetime) - Session creation time
- `updatedAt` (datetime) - Last update time

### Messages Collection
- `sessionId` (string) - Session identifier
- `sender` (string) - user, bot, or agent
- `text` (string) - Message content
- `metadata` (string) - JSON metadata
- `confidence` (double) - AI confidence score
- `createdAt` (datetime) - Message timestamp

### Users Collection
- `userId` (string) - Unique user identifier
- `email` (string) - User email
- `name` (string) - User name
- `roles` (array) - User roles
- `createdAt` (datetime) - Account creation time
- `updatedAt` (datetime) - Last update time

### AI Accuracy Collection
- `sessionId` (string) - Session identifier
- `aiText` (string) - AI response text
- `confidence` (double) - Confidence score
- `tokens` (integer) - Token count
- `latencyMs` (integer) - Response latency
- `responseType` (string) - ai, fallback, or stub
- `humanMark` (string) - Human feedback
- `evaluation` (string) - Admin evaluation
- `metadata` (string) - JSON metadata
- `createdAt` (datetime) - Record timestamp

## 🔄 Migration Scripts

Located in `apps/api/migrations/`:

- `migrate_encrypt_existing_data.js` - Encrypt existing plaintext data
- `rotate_master_key.js` - Rotate encryption master key
- `migrate_decrypt_sample.js` - Test decryption on sample records

Run migrations:
```bash
cd apps/api
node migrations/migrate_encrypt_existing_data.js
```

## 🧪 Testing

The project includes comprehensive error handling and retry logic. For production deployment, consider adding:
- Unit tests for core functions
- Integration tests for API endpoints
- Load testing for scalability
- Security testing for encryption

## 📈 Performance

- **Server-Side Pagination** - Efficient data loading
- **LRU Caching** - In-memory caching for metrics (TTL-based)
- **Connection Pooling** - Optimized database connections
- **Streaming Exports** - Efficient large file exports

## 🐛 Troubleshooting

### Common Issues

1. **Messages not saving**
   - Check Appwrite collection schema matches expected attributes
   - Verify API key has correct permissions
   - Check server logs for error messages

2. **Sessions not appearing**
   - Verify `ensureSessionInAppwrite()` is being called
   - Check Appwrite database connection
   - Ensure collection IDs are correct in `.env`

3. **AI not responding**
   - Verify `GEMINI_API_KEY` is set correctly
   - Check API key has access to Gemini models
   - Review server logs for API errors

4. **Encryption errors**
   - Ensure `MASTER_KEY` is 32 bytes (64 hex characters)
   - Verify encryption attributes exist in collections
   - Check migration scripts ran successfully

## 📝 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For issues and questions, please open an issue on the GitHub repository.

---

**Last Updated:** January 2025
**Version:** 1.0.0
**Status:** Production Ready ✅

