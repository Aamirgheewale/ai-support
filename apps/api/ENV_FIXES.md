# Environment Variables Status & Fixes

## ✅ Currently Set (6/8 required):
- ✅ GEMINI_API_KEY: Set (39 chars, format correct)
- ✅ APPWRITE_ENDPOINT: Set
- ✅ APPWRITE_PROJECT_ID: Set
- ✅ APPWRITE_API_KEY: Set
- ✅ APPWRITE_SESSIONS_COLLECTION_ID: Set
- ✅ APPWRITE_MESSAGES_COLLECTION_ID: Set

## ❌ Missing Required Variables:

### 1. APPWRITE_DATABASE_ID
Add to your `.env` file:
```
APPWRITE_DATABASE_ID=your-database-id-here
```
Get this from your Appwrite Console → Databases → Your Database → Settings

### 2. ADMIN_SHARED_SECRET
Add to your `.env` file:
```
ADMIN_SHARED_SECRET=dev-secret-change-me-in-production
```
This is used to secure admin REST endpoints. Use a strong random string in production.

## ⚠️ Gemini API Key Issue:

Your API key format is correct, but all models are returning 404. This usually means:

### Solution 1: Enable Generative Language API
1. Go to https://console.cloud.google.com/apis/library
2. Search for "Generative Language API"
3. Click "Enable" for your project
4. Wait a few minutes for activation

### Solution 2: Verify API Key Permissions
1. Go to https://console.cloud.google.com/apis/credentials
2. Find your API key
3. Check "API restrictions" - should allow "Generative Language API"
4. Check "Application restrictions" - should allow your usage

### Solution 3: Get a Fresh API Key
1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Make sure it's for "Generative Language API"
4. Update `GEMINI_API_KEY` in your `.env`

### Solution 4: Check API Quotas
1. Go to https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. Verify you have quota available
3. Check if there are any restrictions

## Quick Fix Commands:

After adding the missing variables, run:
```bash
# Check environment
node check_env.js

# Test Gemini API key
node find_working_model.js

# Start server
node index.js
```

