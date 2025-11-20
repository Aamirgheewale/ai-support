# Fix: Collection Schema Mismatch

## Errors You're Seeing

```
⚠️  Failed to ensure session: Invalid document structure: Unknown attribute: "createdAt"
❌ Failed to save message: Invalid document structure: Unknown attribute: "timestamp"
```

## Problem

Your Appwrite collections have different attributes than what the code expects:

1. **Sessions collection**: Doesn't have `createdAt` attribute
2. **Messages collection**: Doesn't have `timestamp` attribute (only has `createdAt`)

## Solution

The code has been updated to handle this automatically. However, you have two options:

### Option 1: Update Collections (Recommended)

Add the missing attributes to match the code:

#### For Sessions Collection:
1. Go to Appwrite Console → Databases → Your Database → `sessions` → Attributes
2. Add attribute: `createdAt` (DateTime, Optional)

#### For Messages Collection:
1. Go to Appwrite Console → Databases → Your Database → `messages` → Attributes  
2. Add attribute: `timestamp` (DateTime, Optional)
   - OR keep using `createdAt` only (code now supports both)

### Option 2: Use Current Schema (Code Updated)

The code has been updated to:
- ✅ Try `createdAt` for sessions, fallback to no `createdAt` if it fails
- ✅ Use only `createdAt` for messages (no `timestamp`)
- ✅ Handle both `createdAt` and `timestamp` when reading history

**You don't need to change anything** - the code will work with your current schema!

## Current Schema Support

The code now supports:

**Sessions:**
- With `createdAt` ✅
- Without `createdAt` ✅

**Messages:**
- With `createdAt` only ✅
- With `timestamp` only ✅
- With both ✅

## Test It

1. **Restart your server**:
   ```bash
   # Stop server (Ctrl+C)
   node index.js
   ```

2. **Send a test message** through your chat widget

3. **Check server logs** - should see:
   ```
   ✅ Created session in Appwrite: s_1234567890
   ✅ Saved message to Appwrite: s_1234567890 (user) [Doc ID: abc123]
   ✅ Saved message to Appwrite: s_1234567890 (bot) [Doc ID: def456]
   ```

4. **Verify storage**:
   ```bash
   node verify_chats_stored.js
   ```

## What Was Fixed

1. ✅ Sessions creation tries `createdAt`, falls back if not supported
2. ✅ Messages use only `createdAt` (removed `timestamp`)
3. ✅ History loading supports both `createdAt` and `timestamp`
4. ✅ Query syntax fixed (spaces in query strings)

## Still Having Issues?

If you still see errors:

1. **Check collection attributes** in Appwrite Console
2. **Verify attribute types** match (String, DateTime, etc.)
3. **Check required flags** - make sure required attributes are marked
4. **Restart server** after any collection changes

The code should now work with your current schema!

