# How to Store Chats in Appwrite

This guide will help you configure Appwrite to store chat messages and sessions.

## Quick Start

1. **Run the diagnostic tool** to check your current setup:
   ```bash
   cd apps/api
   node diagnose_appwrite.js
   ```

2. **Fix any issues** reported by the diagnostic tool

3. **Restart your server** after making changes

## Step-by-Step Setup

### Step 1: Create Appwrite Account and Project

1. Go to [Appwrite Cloud](https://cloud.appwrite.io) or use your self-hosted instance
2. Create a new project (or use existing)
3. Note your **Project ID** from the Settings page

### Step 2: Create Database

1. Go to **Databases** in Appwrite Console
2. Click **Create Database**
3. Give it a name (e.g., "Chat Database")
4. Copy the **Database ID** from the Settings tab

### Step 3: Create Collections

#### Create `sessions` Collection

1. In your database, click **Create Collection**
2. Name it `sessions` (or your preferred name)
3. Copy the **Collection ID**
4. Add these attributes:

| Attribute Name | Type | Size | Required | Default | Array |
|---------------|------|------|----------|---------|-------|
| `sessionId` | string | 255 | ✅ Yes | - | ❌ No |
| `status` | string | 50 | ✅ Yes | "active" | ❌ No |
| `lastSeen` | datetime | - | ❌ No | - | ❌ No |
| `userMeta` | string | 1000 | ❌ No | - | ❌ No |
| `createdAt` | datetime | - | ❌ No | - | ❌ No |
| `needsHuman` | boolean | - | ❌ No | false | ❌ No |
| `assignedAgent` | string | 255 | ❌ No | - | ❌ No |
| `theme` | string | 2000 | ❌ No | - | ❌ No |

5. Set up indexes:
   - Index on `sessionId` (unique)
   - Index on `status`
   - Index on `needsHuman`

#### Create `messages` Collection

1. Create another collection named `messages`
2. Copy the **Collection ID**
3. Add these attributes:

| Attribute Name | Type | Size | Required | Default | Array |
|---------------|------|------|----------|---------|-------|
| `sessionId` | string | 255 | ✅ Yes | - | ❌ No |
| `sender` | string | 50 | ✅ Yes | - | ❌ No |
| `text` | string | 10000 | ✅ Yes | - | ❌ No |
| `timestamp` | datetime | - | ✅ Yes | - | ❌ No |
| `metadata` | string | 2000 | ❌ No | - | ❌ No |
| `confidence` | double | - | ❌ No | - | ❌ No |

4. Set up indexes:
   - Index on `sessionId`
   - Index on `timestamp`
   - Index on `sender`

### Step 4: Create API Key

1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "Chat Server Key")
4. Select **Scopes**:
   - ✅ `databases.read`
   - ✅ `databases.write`
   - ✅ `collections.read`
   - ✅ `collections.write`
   - ✅ `documents.read`
   - ✅ `documents.write`
5. Copy the **API Key** (you won't see it again!)

### Step 5: Configure Environment Variables

Edit `apps/api/.env` and add/update these variables:

```env
# Appwrite Configuration
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
# Or for self-hosted: http://localhost/v1

APPWRITE_PROJECT_ID=your-project-id-here
APPWRITE_API_KEY=your-api-key-here
APPWRITE_DATABASE_ID=your-database-id-here
APPWRITE_SESSIONS_COLLECTION_ID=sessions
APPWRITE_MESSAGES_COLLECTION_ID=messages
```

**Important:** Replace all placeholder values with your actual IDs from Appwrite Console.

### Step 6: Set Collection Permissions

1. Go to your `sessions` collection → **Settings** → **Permissions**
2. Add permission for your API key:
   - **Role**: API Key
   - **Read**: ✅
   - **Create**: ✅
   - **Update**: ✅
   - **Delete**: ❌ (optional)

3. Repeat for `messages` collection

### Step 7: Test Configuration

Run the diagnostic tool:

```bash
cd apps/api
node diagnose_appwrite.js
```

Expected output:
```
✅ All Appwrite env vars are set
✅ Appwrite client created successfully
✅ Database found
✅ Sessions collection accessible
✅ Messages collection accessible
✅ Message saved successfully!
✅ All tests passed! Chat messages should save correctly.
```

### Step 8: Restart Server

After configuring, restart your server:

```bash
cd apps/api
node index.js
```

You should see:
```
✅ Appwrite client initialized
📋 Appwrite Configuration:
   Endpoint: https://cloud.appwrite.io/v1
   Project ID: ✅ Set
   Database ID: ✅ Set
   Sessions Collection: ✅ Set
   Messages Collection: ✅ Set
```

## Troubleshooting

### Messages Not Saving

1. **Check server logs** for error messages:
   ```
   ❌ Failed to save message to Appwrite: ...
   ```

2. **Run diagnostic tool**:
   ```bash
   node diagnose_appwrite.js
   ```

3. **Common issues:**
   - Missing `APPWRITE_DATABASE_ID` in `.env`
   - Missing `APPWRITE_MESSAGES_COLLECTION_ID` in `.env`
   - API key doesn't have write permissions
   - Collection attributes don't match schema
   - Collection IDs are incorrect

### Error: Collection Not Found (404)

- Verify collection IDs in `.env` match Appwrite Console
- Check collection names are correct
- Ensure collections exist in the correct database

### Error: Permission Denied (403)

- Go to Appwrite Console → Settings → API Keys
- Edit your API key
- Ensure it has `databases.write` and `documents.write` scopes
- Update collection permissions to allow API key access

### Error: Bad Request (400)

- Check collection attributes match the required schema
- Verify attribute types are correct (string, datetime, boolean, double)
- Ensure required attributes are marked as required

### Server Shows "Appwrite features disabled"

- Check `.env` file exists in `apps/api/` directory
- Verify `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, and `APPWRITE_API_KEY` are set
- Restart server after adding environment variables

## Verifying Messages Are Saved

1. **Check server logs** - you should see:
   ```
   ✅ Saved message to Appwrite: s_1234567890 (user)
   ✅ Saved message to Appwrite: s_1234567890 (bot)
   ```

2. **Check Appwrite Console**:
   - Go to Databases → Your Database → `messages` collection
   - You should see messages appearing in real-time

3. **Use admin API**:
   ```bash
   curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
     http://localhost:4000/admin/sessions/YOUR_SESSION_ID/messages
   ```

## Next Steps

Once chats are storing correctly:

- ✅ Messages will persist across server restarts
- ✅ Chat history will be available in admin dashboard
- ✅ Conversations can be searched and filtered
- ✅ Analytics can be built on stored data

## Support

If you're still having issues:

1. Run `node diagnose_appwrite.js` and share the output
2. Check server logs for specific error messages
3. Verify all environment variables are set correctly
4. Ensure Appwrite collections are configured properly

