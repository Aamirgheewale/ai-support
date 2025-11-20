# How to Verify Chats Are Being Stored

After the diagnostic tool passes, here are multiple ways to verify that chats are actually being saved to Appwrite.

## Method 1: Run Verification Script (Easiest)

```bash
cd apps/api
node verify_chats_stored.js
```

This will show you:
- ✅ Total number of sessions
- ✅ Total number of messages
- ✅ Recent messages with timestamps
- ✅ Messages grouped by session

**Expected Output:**
```
✅ Found 5 session(s)
✅ Found 23 message(s) total

   Recent Messages (last 20):
   1. [12/15/2024, 2:30:45 PM] 👤 User
      "Hello, I need help with..."
      Session: s_1234567890
   
   2. [12/15/2024, 2:30:46 PM] 🤖 Bot
      "Hello! I'm here to help..."
      Session: s_1234567890
```

## Method 2: Check Appwrite Console (Visual)

1. **Go to Appwrite Console**: https://cloud.appwrite.io
2. **Navigate to**: Databases → Your Database → `messages` collection
3. **Click on "Documents" tab**
4. **You should see**:
   - List of all messages
   - Each message shows: sessionId, sender, text, timestamp
   - Messages appear in real-time as chats happen

**What to Look For:**
- ✅ Messages appear immediately after sending
- ✅ Each message has: sessionId, sender, text, createdAt
- ✅ User messages show `sender: "user"`
- ✅ Bot messages show `sender: "bot"`

## Method 3: Check Server Logs

When your server is running, watch for these log messages:

**When a message is saved successfully:**
```
✅ Saved message to Appwrite: s_1234567890 (user) [Doc ID: abc123xyz]
✅ Saved message to Appwrite: s_1234567890 (bot) [Doc ID: def456uvw]
```

**If messages aren't saving, you'll see:**
```
❌ Failed to save message to Appwrite [s_1234567890]: ...
```

**To watch logs in real-time:**
```bash
# Start server and watch for save messages
node index.js
```

## Method 4: Use Admin API Endpoint

If your server is running, you can query messages via REST API:

```bash
# Get all sessions
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  http://localhost:4000/admin/sessions

# Get messages for a specific session
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  http://localhost:4000/admin/sessions/SESSION_ID/messages
```

Replace:
- `YOUR_ADMIN_SECRET` with your `ADMIN_SHARED_SECRET` from `.env`
- `SESSION_ID` with an actual session ID

## Method 5: Real-Time Test

1. **Start your server**:
   ```bash
   cd apps/api
   node index.js
   ```

2. **Open your chat widget** in a browser

3. **Send a test message**: "Hello, this is a test"

4. **Immediately check**:
   - **Server logs** - Should show: `✅ Saved message to Appwrite`
   - **Appwrite Console** - New message should appear in `messages` collection
   - **Run verification script** - `node verify_chats_stored.js` should show your message

## Quick Verification Checklist

- [ ] Diagnostic tool passes: `node diagnose_appwrite.js`
- [ ] Server logs show: `✅ Saved message to Appwrite`
- [ ] Appwrite Console shows messages in `messages` collection
- [ ] Verification script shows messages: `node verify_chats_stored.js`
- [ ] Messages appear immediately after sending

## Troubleshooting

### Messages Not Appearing

1. **Check server is running** - Messages only save when server is active
2. **Check server logs** - Look for error messages
3. **Verify environment variables** - Run `node diagnose_appwrite.js`
4. **Check Appwrite Console** - Verify collection exists and has correct attributes
5. **Check API key scopes** - Must have `documents.write` permission

### Messages Appear But Then Disappear

- Check if you're filtering or deleting test messages
- Verify collection permissions allow reading
- Check if there's a cleanup script running

### Old Messages Not Showing

- Messages only save **after** you fixed the configuration
- Old messages sent before fixing won't be in Appwrite
- Only new messages after the fix will be stored

## Expected Behavior

✅ **Working correctly when:**
- New messages appear in Appwrite within 1-2 seconds
- Server logs show success messages
- Verification script shows increasing message count
- Messages persist after server restart

❌ **Not working when:**
- Messages don't appear in Appwrite Console
- Server logs show error messages
- Verification script shows 0 messages
- Messages disappear after server restart

## Next Steps

Once verified that chats are storing:
- ✅ Chat history will persist across sessions
- ✅ Admin dashboard can show conversations
- ✅ You can search and filter messages
- ✅ Analytics can be built on stored data

