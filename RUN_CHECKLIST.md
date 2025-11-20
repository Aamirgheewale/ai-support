# Run Checklist - AI Support System

## Prerequisites

1. Node.js v20.x installed
2. pnpm installed (`npm install -g pnpm`)
3. Appwrite instance configured (or use Appwrite Cloud)

## Step 1: Install Backend Dependencies

```bash
cd ai-support/apps/api
pnpm add node-appwrite express cors ioredis @google/generative-ai socket.io dotenv
```

## Step 2: Configure Environment Variables

Create `apps/api/.env` with:

```env
# Server
PORT=4000

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-flash

# Redis (set to 'disabled' to skip)
REDIS_URL=disabled
# Or: REDIS_URL=redis://localhost:6379

# Appwrite
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
APPWRITE_DATABASE_ID=your-database-id
APPWRITE_SESSIONS_COLLECTION_ID=your-sessions-collection-id
APPWRITE_MESSAGES_COLLECTION_ID=your-messages-collection-id

# Admin
ADMIN_SHARED_SECRET=dev-secret-change-me-in-production
```

## Step 3: Set Up Appwrite Collections

In your Appwrite console:

1. Create a Database
2. Create `sessions` collection with attributes:
   - `sessionId` (string, required)
   - `status` (string, default: "active")
   - `lastSeen` (datetime)
   - `userMeta` (string, JSON)
   - `needsHuman` (boolean, default: false)
   - `assignedAgent` (string, optional)
   - `theme` (string, JSON)
3. Create `messages` collection with attributes:
   - `sessionId` (string, required)
   - `sender` (string, required)
   - `text` (string, required)
   - `timestamp` (datetime)
   - `confidence` (double, optional)
   - `agentId` (string, optional)

## Step 4: Start Backend Server

```bash
cd ai-support/apps/api
node index.js
```

Expected logs:
- `✅ Redis disabled` (if REDIS_URL=disabled)
- `✅ Gemini client initialized`
- `✅ Appwrite client initialized`
- `🚀 Socket.IO API server listening on port 4000`

## Step 5: Install Admin Dependencies

```bash
cd ai-support/apps/admin
pnpm install
```

Create `apps/admin/.env`:
```env
VITE_ADMIN_SECRET=dev-secret-change-me-in-production
```

## Step 6: Start Admin UI

```bash
cd ai-support/apps/admin
pnpm dev
```

Admin UI runs on `http://localhost:5174`

## Step 7: Install Widget Dependencies (if not done)

```bash
cd ai-support/apps/widget
pnpm install
```

## Step 8: Start Widget Dev Server

```bash
cd ai-support/apps/widget
pnpm dev
```

Widget runs on `http://localhost:5173`

## Step 9: Test Flows

### Test Widget → AI Chat

1. Open `http://localhost:5173`
2. Click "Start Chat"
3. Send a message
4. Verify AI response appears
5. Check backend logs for: `✅ Gemini reply sent`

### Test Admin → View Sessions

1. Open `http://localhost:5174`
2. View sessions list
3. Click a session to view messages
4. Enter agent ID and click "Assign to Me"
5. Send agent message

### Test Agent Takeover

1. In widget, send a message
2. In admin, assign session to agent
3. Send agent message from admin
4. Verify message appears in widget
5. Widget should show "Agent X joined the conversation"

### Test Theme Customization

```bash
curl -X POST http://localhost:4000/session/YOUR_SESSION_ID/theme \
  -H "Content-Type: application/json" \
  -d '{"themeVars":{"primary-color":"#ff0000"}}'
```

Refresh widget to see theme applied.

## Step 10: Test Appwrite Integration

```bash
cd ai-support/apps/api
node test_appwrite_list.js
```

Should list sessions and messages from Appwrite.

## Troubleshooting

- **"Appwrite not configured"**: Check `.env` variables
- **"Gemini API errors"**: Verify `GEMINI_API_KEY` is valid
- **"Redis connection errors"**: Set `REDIS_URL=disabled` for dev
- **Admin auth fails**: Ensure `ADMIN_SHARED_SECRET` matches in backend and admin `.env`
- **Socket.IO not connecting**: Check CORS settings and ports

## Production Deployment

1. Set `ADMIN_SHARED_SECRET` to a strong random value
2. Configure proper CORS origins
3. Use production Appwrite instance
4. Set up Redis for production
5. Build widget: `cd apps/widget && pnpm build`
6. Deploy widget bundle to CDN
7. Update `apiBase` in embed script to production API URL

