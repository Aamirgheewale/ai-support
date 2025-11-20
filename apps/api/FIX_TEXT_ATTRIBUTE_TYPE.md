# 🔧 Quick Fix: Text Attribute Type Error

## Error Message
```
❌ Failed to save test message: Invalid document structure: Attribute "text" has invalid format. Value must be a valid email address
   Error code: 400
```

## Problem
Your `text` attribute in the `messages` collection is configured as **Email** type instead of **String** type.

## Solution (2 minutes)

### Step 1: Go to Appwrite Console
👉 https://cloud.appwrite.io

### Step 2: Navigate to Messages Collection Attributes
1. Click **Databases**
2. Click your database (e.g., "ai_chatbot")
3. Click **messages** collection
4. Click **Attributes** tab

### Step 3: Fix the "text" Attribute

**Option A: Delete and Recreate (Recommended)**
1. Find the **text** attribute in the list
2. Click the **three dots (⋯)** next to it
3. Click **Delete** → Confirm
4. Click **Create Attribute**
5. Select **String** (NOT Email!)
6. Enter:
   - **Key**: `text`
   - **Size**: `10000`
   - **Required**: ✅ Yes
   - **Array**: ❌ No
7. Click **Create**

**Option B: Update Existing (if possible)**
- Some Appwrite versions don't allow changing attribute types
- If you see an "Update" option, change type from Email to String
- Otherwise, use Option A (delete and recreate)

### Step 4: Verify Other Attributes

While you're there, check these attributes have correct types:

| Attribute | Type Should Be | Common Wrong Type |
|----------|---------------|-------------------|
| `sessionId` | **String** | Email, Integer |
| `sender` | **String** | Email |
| `text` | **String** | Email ❌ (this is your problem!) |
| `createdAt` | **DateTime** | String |
| `metadata` | **String** | Email |
| `confidence` | **Double/Float** | String |

### Step 5: Test Again
```bash
cd apps/api
node diagnose_appwrite.js
```

You should see: ✅ Message saved successfully!

## Visual Guide

```
Appwrite Console
│
├── Databases
│   └── Your Database (ai_chatbot)
│       └── messages Collection
│           └── Attributes Tab
│               ├── text (Email) ❌ WRONG!
│               │   └── Delete → Recreate as String ✅
│               └── Verify other attributes...
```

## Why This Happened

When creating attributes in Appwrite, it's easy to accidentally select the wrong type. The "text" attribute was likely created as Email type (maybe because it's a common option), but it needs to be String to store chat messages.

## After Fixing

Once `text` is String type:
- ✅ Messages will save correctly
- ✅ Chat history will work
- ✅ All message content will be stored

## Still Having Issues?

If you still get errors:

1. **Check attribute types** - Not just names, but TYPES matter!
2. **Delete and recreate** - Sometimes easier than trying to update
3. **Check required flags** - Required attributes must be marked as required
4. **Verify sizes** - String attributes need size limits (10000 for text is good)

## Quick Checklist

- [ ] Go to messages → Attributes
- [ ] Find "text" attribute
- [ ] Delete if type is Email
- [ ] Create new: Name="text", Type="String", Size=10000, Required=Yes
- [ ] Verify other attributes have correct types
- [ ] Run diagnostic: `node diagnose_appwrite.js`
- [ ] Should see: ✅ Message saved successfully!

