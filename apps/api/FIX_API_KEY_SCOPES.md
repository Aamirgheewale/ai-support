# Fix: API Key Missing Scopes Error

## Error Message
```
❌ Cannot access database: User (role: guests) missing scopes (["databases.read"])
   Error code: 401
```

## Problem
Your Appwrite API key doesn't have the required scopes (permissions) to access databases and collections.

## Solution (5 minutes)

### Step 1: Go to Appwrite Console
1. Open https://cloud.appwrite.io (or your Appwrite instance URL)
2. Log in to your account

### Step 2: Navigate to API Keys
1. Click on **Settings** (gear icon in the left sidebar)
2. Click on **API Keys** in the settings menu

### Step 3: Edit Your API Key
**Option A: Edit Existing Key**
1. Find your API key in the list
2. Click the **three dots (⋯)** next to it
3. Click **Update** or **Edit**

**Option B: Create New Key (Recommended)**
1. Click **Create API Key** button
2. Give it a name: `Chat Server Key`
3. **IMPORTANT**: Select these scopes:
   - ✅ `databases.read`
   - ✅ `databases.write`
   - ✅ `collections.read`
   - ✅ `collections.write`
   - ✅ `documents.read`
   - ✅ `documents.write`
4. Click **Create**
5. **COPY THE API KEY IMMEDIATELY** (you won't see it again!)

### Step 4: Update Your .env File
1. Open `apps/api/.env`
2. Update `APPWRITE_API_KEY` with your new key:
   ```env
   APPWRITE_API_KEY=your-new-api-key-here
   ```
3. Save the file

### Step 5: Test Again
Run the diagnostic tool:
```bash
cd apps/api
node diagnose_appwrite.js
```

You should now see:
```
✅ Database found
✅ Sessions collection accessible
✅ Messages collection accessible
✅ Message saved successfully!
```

## Visual Guide

### Finding API Keys in Appwrite Console:
```
Appwrite Console
├── Settings (⚙️)
    └── API Keys
        ├── [Your API Key] → Edit → Select Scopes
        └── Create API Key → Select Scopes → Create
```

### Required Scopes Checklist:
- [ ] `databases.read` - Read database information
- [ ] `databases.write` - Create/update databases
- [ ] `collections.read` - Read collection information
- [ ] `collections.write` - Create/update collections
- [ ] `documents.read` - Read documents (messages, sessions)
- [ ] `documents.write` - Create/update documents (messages, sessions)

## Why This Happened

When you create an API key in Appwrite, you need to explicitly select which scopes (permissions) it should have. By default, API keys don't have any scopes, which is why you're getting the "missing scopes" error.

## After Fixing

Once you've updated your API key with the correct scopes:
1. ✅ Messages will save to Appwrite
2. ✅ Sessions will be stored
3. ✅ Chat history will persist
4. ✅ Admin dashboard will work

## Still Having Issues?

If you still get errors after updating scopes:

1. **Verify API Key Format**
   - Should start with something like: `standard_` or `secret_`
   - Should be a long string (50+ characters)

2. **Check Collection Permissions**
   - Go to your database → Collections → `messages` → Settings → Permissions
   - Ensure API key role has Read, Create, Update permissions

3. **Verify Database ID**
   - Make sure `APPWRITE_DATABASE_ID` in `.env` matches your database ID
   - Get it from: Databases → Your Database → Settings

4. **Restart Server**
   - After updating `.env`, restart your server:
   ```bash
   # Stop server (Ctrl+C)
   node index.js
   ```

## Quick Test

After fixing, test with:
```bash
node diagnose_appwrite.js
```

Expected success output:
```
✅ All Appwrite env vars are set
✅ Appwrite client created successfully
✅ Database found: Chat Database
✅ Sessions collection accessible (0 documents)
✅ Messages collection accessible (0 documents)
✅ Message saved successfully!
✅ All tests passed! Chat messages should save correctly.
```

