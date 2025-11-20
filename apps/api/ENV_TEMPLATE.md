# Environment Variables Template

Create a `.env` file in `apps/api/` with the following variables:

```env
# Server Configuration
PORT=4000

# Gemini AI Configuration (REQUIRED for AI responses)
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-flash

# Redis Configuration (set to 'disabled' to skip Redis)
REDIS_URL=disabled
# Or use: REDIS_URL=redis://localhost:6379

# Appwrite Configuration (REQUIRED for persistence)
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
APPWRITE_DATABASE_ID=your-database-id
APPWRITE_SESSIONS_COLLECTION_ID=your-sessions-collection-id
APPWRITE_MESSAGES_COLLECTION_ID=your-messages-collection-id

# Admin Authentication (REQUIRED for admin endpoints)
ADMIN_SHARED_SECRET=dev-secret-change-me-in-production
```

## Required Variables

**Minimum for basic functionality:**
- `GEMINI_API_KEY` - Required for AI responses (or will run in stub mode)
- `ADMIN_SHARED_SECRET` - Required for admin endpoints

**For full functionality:**
- All Appwrite variables - Required for session/message persistence
- `REDIS_URL` - Optional, set to `disabled` if not using Redis

## Notes

- The `.env` file is gitignored for security
- Replace all placeholder values with your actual credentials
- `GEMINI_MODEL` defaults to `gemini-1.5-flash` if not set
- `PORT` defaults to `4000` if not set
- `REDIS_URL=disabled` will skip Redis initialization

