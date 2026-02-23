# AI Customer Support Chat System

A production-ready, full-stack AI-powered customer support chat system with real-time messaging, agent routing, analytics dashboard, and comprehensive admin features.

## 🚀 Features

### Core Features
- **Real-time Chat Widget** - Embeddable widget with theme customization
- **AI-Powered Responses** - Multi-provider LLM support (Gemini, OpenAI, Anthropic) with failover
- **Agent Routing** - Seamless handoff from AI to human agents
- **Session Management** - Full conversation history, 30-minute session expiry, localStorage persistence
- **Analytics Dashboard** - KPIs, traffic trends, agent leaderboard, and performance insights
- **Role-Based Access Control (RBAC)** - Two-tier permissions: `admin` and `agent`
- **Accuracy Logging** - Track AI response quality with confidence scores and feedback
- **Export Functionality** - Export conversations and analytics data (CSV/JSON)
- **Server-Side Pagination** - Efficient data loading for large datasets
- **Encryption at Rest** - AES-256-GCM envelope encryption for sensitive data
- **TLS Enforcement** - HTTPS/WSS checks with `FORCE_TLS` flag

### AI & Chat Features
- **LLM Fleet Manager** - Manage Gemini, OpenAI, and Anthropic providers from admin UI
- **Dynamic Quick Reply Suggestions** - LLM returns clickable follow-up suggestions
- **Vision Support** - Image attachment analysis via Gemini and OpenAI
- **Auto-Reply Engine** - In-memory exact/partial/keyword matching for instant replies
- **Typing Indicators** - Real-time typing state in both widget and admin chat
- **Streaming Responses** - Bot responses stream token-by-token via `bot_stream`

### Agent & Admin Features
- **Agent Inbox** - Personal inbox with Active, Unassigned, and Resolved tabs
- **Internal Notes** - Private agent notes not visible to users
- **Image Annotation** - Annotate screenshots before sending
- **Canned Responses** - Slash-command quick replies with bulk Excel import
- **Notifications** - Real-time in-app notifications for agent assignments and requests
- **Ticket System** - Offline support tickets with email notifications (Resend)
- **Live Visitors** - Track active visitors and initiate proactive chat
- **Business Hours** - Automatic offline form outside configured hours

### Widget Features
- **Embeddable Library** - UMD/ES builds for drop-in website integration
- **Offline Form** - Contact form for business hours or AI failure fallback
- **Agent Request** - "Connect to Agent" button with 3-minute countdown timer
- **Image Attachments** - Upload images to Appwrite Storage (max 50MB)
- **Dynamic Welcome Message** - Admin-configurable welcome message

## 📁 Project Structure

```
ai-support/
├── apps/
│   ├── api/                   # Backend API server (Node.js/Express)
│   │   ├── index.js           # Main server entry point (160 lines)
│   │   ├── config/            # Appwrite clients + shared in-memory state
│   │   ├── routes/            # REST API routes (10 files)
│   │   ├── controllers/       # Business logic (10 files)
│   │   ├── services/
│   │   │   ├── llm/           # LLM Fleet Manager (Gemini, OpenAI, Anthropic)
│   │   │   ├── chat/          # Auto-reply engine (responseService.js)
│   │   │   ├── chatService.js
│   │   │   ├── settingsService.js
│   │   │   ├── notificationService.js
│   │   │   └── emailService.js
│   │   ├── sockets/
│   │   │   └── socketHandler.js  # All real-time events (615 lines)
│   │   ├── lib/               # encryption.js, parsePaginationParams.js
│   │   └── migrations/        # DB migration scripts
│   ├── admin/                 # Admin dashboard (React/TypeScript)
│   │   └── src/
│   │       ├── pages/         # 16 pages incl. AgentInbox, Dashboard
│   │       ├── components/    # 42 components across 8 subdirectories
│   │       ├── context/       # NotificationContext, SoundContext, ThemeContext
│   │       └── hooks/         # useAuth, useSound, useAppwriteUpload, useTyping
│   └── widget/                # Chat widget (React/TypeScript)
│       └── src/
│           ├── components/
│           │   ├── EmbedWidget.tsx  # Main widget (2,821 lines)
│           │   └── Layout.tsx
│           └── hooks/         # useAttachmentUpload, useTyping
├── docker-compose.yml         # Local multi-service development
├── Dockerfile.admin           # Railway admin deployment
├── Dockerfile.widget          # Railway widget deployment
├── pnpm-workspace.yaml
└── README.md
```

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **Socket.IO** with Redis adapter (horizontal scaling)
- **Appwrite** for database and file storage
- **Google Gemini / OpenAI / Anthropic** AI providers
- **Helmet** for security headers
- **AES-256-GCM** envelope encryption
- **Resend** for transactional email (ticket notifications)

### Frontend (Admin & Widget)
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Socket.IO Client** for real-time updates
- **Lucide React** for icons
- **Appwrite SDK** for file uploads

## 📋 Prerequisites

- **Node.js** 18+ and **pnpm**
- **Appwrite** instance (cloud or self-hosted)
- **Gemini API Key** — [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Redis** (optional, required for horizontal scaling)
- **Resend API Key** (optional, required for ticket email notifications)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-support
   ```

2. **Install all dependencies**
   ```bash
   # From the repo root (installs all workspaces)
   pnpm install

   # Or install individually
   cd apps/api && pnpm install
   cd apps/admin && pnpm install
   cd apps/widget && pnpm install
   ```

3. **Set up Appwrite collections**

   Create these collections in your Appwrite database:
   | Collection ID | Purpose |
   |---|---|
   | `sessions` | Chat sessions |
   | `messages` | Chat messages |
   | `users` | Admin/Agent accounts |
   | `ai_accuracy` | AI response accuracy logs |
   | `accuracy_audit` | Accuracy feedback audit |
   | `roleChanges` | Role change history |
   | `notifications` | Agent notifications |
   | `tickets` | Offline support tickets |
   | `canned_responses` | Canned reply templates |
   | `llm_settings` | LLM provider configurations |

   Then run migration scripts to create required collections:
   ```bash
   cd apps/api
   node migrate_create_ai_accuracy_collection.js
   node migrate_create_users_collection.js
   # Encrypt existing data (if needed)
   node migrations/migrate_encrypt_existing_data.js
   # Add prefs field to users (if upgrading)
   node migrations/migrate_add_prefs_to_users.js
   ```

4. **Configure environment variables**

   **Backend (`apps/api/.env`):**
   ```env
   # Server
   PORT=4000
   NODE_ENV=development

   # Appwrite
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   APPWRITE_PROJECT_ID=your_project_id
   APPWRITE_API_KEY=your_api_key
   APPWRITE_DATABASE_ID=your_database_id
   APPWRITE_SESSIONS_COLLECTION_ID=sessions
   APPWRITE_MESSAGES_COLLECTION_ID=messages
   APPWRITE_USERS_COLLECTION_ID=users
   APPWRITE_AI_ACCURACY_COLLECTION_ID=ai_accuracy
   APPWRITE_ACCURACY_AUDIT_COLLECTION_ID=accuracy_audit
   APPWRITE_ROLE_CHANGES_COLLECTION_ID=roleChanges
   APPWRITE_NOTIFICATIONS_COLLECTION_ID=notifications
   APPWRITE_TICKETS_COLLECTION_ID=tickets
   APPWRITE_CANNED_RESPONSES_COLLECTION_ID=canned_responses
   APPWRITE_LLM_SETTINGS_COLLECTION_ID=llm_settings

   # Default AI Provider
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.0-flash

   # Security
   ADMIN_SHARED_SECRET=your_secure_secret_key
   MASTER_KEY_BASE64=your_32_byte_base64_encoded_key   # openssl rand -base64 32

   # Encryption
   ENCRYPTION_ENABLED=true
   REDACT_PII=false

   # TLS (set to true in production)
   FORCE_TLS=false

   # CORS — comma-separated list of extra allowed origins
   # Leave unset to use only the hardcoded defaults
   # CORS_ALLOWED_ORIGINS=https://your-admin.railway.app,https://your-widget.railway.app

   # Redis (optional — enables Socket.IO horizontal scaling)
   # REDIS_URL=redis://localhost:6379

   # Email notifications (optional)
   # RESEND_API_KEY=your_resend_api_key
   # RESEND_FROM_EMAIL=support@yourdomain.com
   ```

   **Admin Dashboard (`apps/admin/.env`):**
   ```env
   VITE_API_BASE=http://localhost:4000
   VITE_SOCKET_URL=http://localhost:4000
   VITE_ADMIN_SECRET=your_secure_secret_key
   ```

   **Widget (`apps/widget/.env`):**
   ```env
   VITE_API_BASE=http://localhost:4000
   VITE_SOCKET_URL=http://localhost:4000
   VITE_APPWRITE_PROJECT_ID=your_project_id   # Required for file uploads
   VITE_APPWRITE_BUCKET_ID=your_bucket_id     # Required for file uploads
   ```

## 🚀 Running the Application

### Development Mode

```bash
# Terminal 1 — Backend API (http://localhost:4000)
cd apps/api
node index.js

# Terminal 2 — Admin Dashboard (http://localhost:5173)
cd apps/admin
pnpm dev

# Terminal 3 — Widget demo (http://localhost:5174)
cd apps/widget
pnpm dev
```

### Production Build

```bash
# Admin dashboard
cd apps/admin && pnpm build

# Widget — full demo site
cd apps/widget && pnpm build

# Widget — embeddable library (UMD + ES)
cd apps/widget && pnpm build:lib

# Start API
cd apps/api && node index.js
```

### Docker (Local Multi-Service)

```bash
docker-compose up
```

## 📡 API Endpoints (Key Routes)

### Authentication
- `POST /auth/signup` — Create user (admin only)
- `POST /auth/login` — Login
- `GET /me` — Current user info
- `PATCH /me/prefs` — Update user notification preferences

### Sessions
- `GET /admin/sessions` — List sessions (paginated, filterable)
- `GET /admin/sessions/:sessionId` — Session details
- `GET /admin/sessions/:sessionId/messages` — Messages (paginated)
- `PUT /admin/sessions/:sessionId/assign` — Assign agent
- `PUT /admin/sessions/:sessionId/close` — Close session
- `POST /admin/sessions/export` — Export (CSV/JSON)

### LLM Fleet Manager (`/api/admin`)
- `GET /api/admin/llm-configs` — List all provider configs
- `POST /api/admin/llm-config` — Add/update provider config
- `PATCH /api/admin/llm-config/:id/activate` — Set active provider
- `DELETE /api/admin/llm-config/:id` — Remove provider
- `GET/POST /api/admin/system-prompt` — Get/set AI system prompt
- `GET/POST /api/admin/context-limit` — Get/set message context window
- `GET/POST /api/admin/welcome-message` — Get/set widget welcome message
- `GET/POST /api/admin/image-prompt` — Get/set image analysis prompt

### Support
- `POST /api/tickets` — Submit offline support ticket
- `GET /api/tickets` — List tickets (admin/agent)
- `POST /api/tickets/reply` — Reply and resolve ticket
- `GET /api/notifications` — Agent notifications
- `PATCH /api/notifications/:id/read` — Mark as read
- `GET /api/canned-responses` — List canned responses
- `POST /api/canned-responses` — Create canned response
- `PUT /api/canned-responses/:id` — Update
- `DELETE /api/canned-responses/:id` — Delete

## 🔌 Socket.IO Events

| Direction | Event | Description |
|---|---|---|
| Client → Server | `start_session` | Start a new chat session |
| Client → Server | `user_message` | Send message (with optional `attachmentUrl`) |
| Client → Server | `agent_message` | Agent reply (with ack callback) |
| Client → Server | `agent_auth` | Agent authenticates socket |
| Client → Server | `join_session` | Join session room |
| Client → Server | `join_admin_feed` | Join admin notification feed |
| Client → Server | `typing_start` / `typing_stop` | Typing indicators |
| Client → Server | `request_agent` | User requests human agent |
| Client → Server | `end_session` | Close conversation |
| Client → Server | `internal_note` | Save private agent note |
| Client → Server | `visitor_join` | Register live visitor |
| Client → Server | `initiate_chat` | Admin starts proactive chat |
| Server → Client | `session_started` | Session created |
| Server → Client | `bot_message` | AI/auto-reply response (includes `suggestions[]`) |
| Server → Client | `bot_stream` | Streaming partial response |
| Server → Client | `agent_message` | Agent message |
| Server → Client | `display_typing` | Typing indicator |
| Server → Client | `new_notification` | New notification |
| Server → Client | `live_visitors_update` | Updated visitor list |
| Server → Client | `agent_initiated_chat` | Proactive chat from admin |

## 🔐 Security Features

- **Envelope Encryption** — AES-256-GCM; each record has a unique data key encrypted with `MASTER_KEY_BASE64`
- **Key Rotation** — `rotate_master_key.js` migration for zero-downtime key rotation
- **RBAC** — `admin` (full access) and `agent` (limited access) roles
- **CORS Whitelist** — Explicit origin allowlist; no wildcards
- **Helmet** — Security headers (CSP disabled for Socket.IO compatibility)
- **TLS Enforcement** — `FORCE_TLS=true` enforces HTTPS/WSS in production
- **Redis Adapter** — Graceful fallback to in-memory if Redis is unavailable

## 📊 Database Collections

| Collection | Key Fields |
|---|---|
| `sessions` | sessionId, status, assignedAgentId, userMeta, theme, aiPaused |
| `messages` | sessionId, sender, text, metadata (JSON), confidence |
| `users` | userId, email, name, roles[], prefs (JSON) |
| `ai_accuracy` | sessionId, aiText, confidence, latencyMs, responseType, humanMark |
| `notifications` | type, content, sessionId, targetUserId, isRead |
| `tickets` | ticketId, name, email, query, status, resolvedBy |
| `canned_responses` | shortcut, content, category, match_type, is_active |
| `llm_settings` | provider, model, apiKey (encrypted), isActive, healthStatus |

## 🔄 Migration Scripts

```bash
cd apps/api

# Create Appwrite collections
node migrate_create_ai_accuracy_collection.js
node migrate_create_users_collection.js

# Encrypt existing plaintext data
node migrations/migrate_encrypt_existing_data.js

# Rotate master key
node migrations/rotate_master_key.js

# Add prefs column to users (one-time upgrade)
node migrations/migrate_add_prefs_to_users.js
```

## 📈 Performance

- **Redis Adapter** — Socket.IO horizontal scaling across multiple API instances
- **In-Memory Auto-Reply Cache** — Zero-latency exact/partial/keyword matching
- **LRU Caching** — Dashboard metrics cached with TTL
- **Server-Side Pagination** — All list endpoints paginated
- **Streaming Exports** — Efficient large file downloads
- **Graceful Degradation** — Redis, Appwrite, and LLM failures handled without crash

## 🐛 Troubleshooting

| Issue | Fix |
|---|---|
| Messages not saving | Check Appwrite collection schema and API key permissions |
| AI not responding | Verify `GEMINI_API_KEY` and check `/api/admin/llm-configs` health status |
| Encryption errors | Ensure `MASTER_KEY_BASE64` is set; run `migrate_encrypt_existing_data.js` |
| CORS errors | Add origin to `CORS_ALLOWED_ORIGINS` env var (comma-separated) |
| Socket not connecting | Confirm `VITE_SOCKET_URL` matches the API server address |
| File uploads failing | Set `VITE_APPWRITE_PROJECT_ID` and `VITE_APPWRITE_BUCKET_ID` in widget `.env` |
| Redis connection error | Server falls back to in-memory adapter automatically; check `REDIS_URL` |
| `prefs` save error | Run `migrations/migrate_add_prefs_to_users.js` to add the column |

## 📝 License

ISC

---

**Last Updated:** February 2026
**Version:** 2.0.0
**Status:** Production Ready ✅
