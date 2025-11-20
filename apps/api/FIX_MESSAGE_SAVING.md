# Fix: Messages Not Saving to Database

## Problem
Messages are not being saved because `APPWRITE_DATABASE_ID` is missing from your `.env` file.

## Solution

### Step 1: Get Your Database ID from Appwrite

1. Go to your Appwrite Console: https://cloud.appwrite.io
2. Navigate to **Databases** → Select your database
3. Click on **Settings** tab
4. Copy the **Database ID** (it looks like: `65a1b2c3d4e5f6g7h8i9j0`)

### Step 2: Add to Your .env File

Open `apps/api/.env` and add this line:

```env
APPWRITE_DATABASE_ID=your-database-id-here
```

Replace `your-database-id-here` with the actual Database ID from Step 1.

### Step 3: Verify Your Complete .env File

Your `.env` should have all these variables:

```env
# Server
PORT=4000

# Gemini AI
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.0-flash

# Appwrite (ALL REQUIRED)
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
APPWRITE_DATABASE_ID=your-database-id-here  ← ADD THIS!
APPWRITE_SESSIONS_COLLECTION_ID=sessions
APPWRITE_MESSAGES_COLLECTION_ID=messages

# Admin
ADMIN_SHARED_SECRET=dev-secret-change-me
```

### Step 4: Test Message Saving

Run the test script:

```bash
cd apps/api
node test_save_message.js
```

Expected output:
```
✅ All Appwrite env vars are set
🧪 Testing message save...
✅ Message saved successfully!
✅ Appwrite is configured correctly! Messages should save now.
```

### Step 5: Restart Your Server

After adding `APPWRITE_DATABASE_ID`, restart your server:

```bash
# Stop current server (Ctrl+C)
node index.js
```

### Step 6: Verify Messages Are Saving

1. Send a message through the chat widget
2. Check your server logs - you should see:
   ```
   ✅ Saved message to Appwrite: s_1234567890 (user)
   ✅ Saved message to Appwrite: s_1234567890 (bot)
   ```
3. Check Appwrite Console → Databases → messages collection
4. You should see your messages there!

## Why This Happened

The code checks for `APPWRITE_DATABASE_ID` before saving:

```javascript
if (!awDatabases || !APPWRITE_DATABASE_ID || !APPWRITE_MESSAGES_COLLECTION_ID) {
  return; // Silently fails if missing
}
```

Without `APPWRITE_DATABASE_ID`, the function returns early and messages are never saved.

## Additional Checks

If messages still don't save after adding `APPWRITE_DATABASE_ID`:

1. **Check API Key Permissions**: Your API key needs write access to the database
2. **Check Collection Attributes**: Make sure your `messages` collection has these attributes:
   - `sessionId` (string, required)
   - `sender` (string, required)
   - `text` (string, required)
   - `timestamp` (datetime)
   - `metadata` (string)
   - `confidence` (double, optional)
3. **Check Server Logs**: Look for error messages like:
   - `⚠️ Failed to save message to Appwrite: ...`
4. **Run Test Script**: `node test_save_message.js` will show detailed errors

## Quick Checklist

- [ ] `APPWRITE_DATABASE_ID` added to `.env`
- [ ] Server restarted after adding variable
- [ ] Test script passes (`node test_save_message.js`)
- [ ] Server logs show "✅ Saved message to Appwrite"
- [ ] Messages appear in Appwrite Console

