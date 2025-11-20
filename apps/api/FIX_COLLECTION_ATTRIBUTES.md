# Fix: Collection Attributes Mismatch

## Error Message
```
❌ Failed to save test message: Invalid document structure: Unknown attribute: "timestamp"
   Error code: 400
```

## Problem
Your `messages` collection in Appwrite doesn't have the attributes that the code expects, or has different attribute names.

## Solution

### Step 1: Check Current Collection Attributes

1. Go to **Appwrite Console**: https://cloud.appwrite.io
2. Navigate to: **Databases** → Your Database → **messages** collection
3. Click on **Attributes** tab
4. Note which attributes exist

### Step 2: Update Collection Attributes

Your `messages` collection needs these attributes:

#### Required Attributes:
- ✅ **sessionId** (String, 255 chars, Required)
- ✅ **sender** (String, 50 chars, Required)  
- ✅ **text** (String, 10000 chars, Required)
- ✅ **createdAt** (DateTime, Required)

#### Optional Attributes:
- **metadata** (String, 2000 chars, Optional)
- **confidence** (Double, Optional)

### Step 3: Add Missing Attributes

For each missing attribute:

1. Click **Create Attribute**
2. Select the type (String, DateTime, or Double)
3. Enter the attribute name exactly as shown above
4. Set size/constraints:
   - `sessionId`: Size 255, Required ✅
   - `sender`: Size 50, Required ✅
   - `text`: Size 10000, Required ✅
   - `createdAt`: DateTime, Required ✅
   - `metadata`: Size 2000, Optional
   - `confidence`: Double, Optional
5. Click **Create**

### Step 4: Remove Conflicting Attributes (if any)

If you have a `timestamp` attribute but the code uses `createdAt`:
- Either keep `timestamp` and remove `createdAt` (then update code)
- Or remove `timestamp` and use `createdAt` (recommended)

**Recommended:** Use `createdAt` only (remove `timestamp` if it exists)

### Step 5: Test Again

```bash
cd apps/api
node diagnose_appwrite.js
```

## Quick Fix Checklist

- [ ] Go to Appwrite Console → Databases → messages → Attributes
- [ ] Verify `sessionId` exists (string, required)
- [ ] Verify `sender` exists (string, required)
- [ ] Verify `text` exists (string, required)
- [ ] Verify `createdAt` exists (datetime, required)
- [ ] Add `metadata` if missing (string, optional)
- [ ] Add `confidence` if missing (double, optional)
- [ ] Remove `timestamp` if it conflicts (use `createdAt` instead)
- [ ] Run diagnostic: `node diagnose_appwrite.js`

## Expected Collection Schema

```
messages Collection Attributes:
├── sessionId (string, 255, required) ✅
├── sender (string, 50, required) ✅
├── text (string, 10000, required) ✅
├── createdAt (datetime, required) ✅
├── metadata (string, 2000, optional)
└── confidence (double, optional)
```

## After Fixing

Once attributes match, you should see:
```
✅ Message saved successfully!
✅ All tests passed! Chat messages should save correctly.
```

## Still Having Issues?

If you still get attribute errors:

1. **Check exact attribute names** - They must match exactly (case-sensitive)
2. **Check attribute types** - String vs DateTime vs Double must match
3. **Check required flags** - Required attributes must be marked as required
4. **Remove extra attributes** - If you have attributes the code doesn't use, that's OK, but make sure required ones exist

## Alternative: Update Code to Match Your Schema

If your collection has different attribute names, you can update the code in `index.js`:

Find `saveMessageToAppwrite` function and update the `messageDoc` object to match your collection schema.

