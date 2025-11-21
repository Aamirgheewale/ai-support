# Manual Attribute Setup Guide

If the migration script fails to create attributes automatically, you can create them manually in the Appwrite Console.

## Users Collection Attributes

Go to: **Appwrite Console → Databases → Your Database → users → Attributes**

Create these attributes in order:

### 1. userId (String)
- **Key**: `userId`
- **Type**: String
- **Size**: 255
- **Required**: ✅ Yes
- **Array**: ❌ No
- **Default**: Leave empty or `null`
- **Unique**: ✅ Yes

### 2. email (String)
- **Key**: `email`
- **Type**: String
- **Size**: 255
- **Required**: ✅ Yes
- **Array**: ❌ No
- **Default**: Leave empty or `null`
- **Unique**: ✅ Yes

### 3. name (String)
- **Key**: `name`
- **Type**: String
- **Size**: 255
- **Required**: ❌ No
- **Array**: ❌ No
- **Default**: Leave empty or `null`
- **Unique**: ❌ No

### 4. roles (String Array)
- **Key**: `roles`
- **Type**: String
- **Size**: 255
- **Required**: ❌ No
- **Array**: ✅ Yes
- **Default**: Leave empty or `null`
- **Unique**: ❌ No

### 5. createdAt (DateTime)
- **Key**: `createdAt`
- **Type**: DateTime
- **Required**: ✅ Yes
- **Array**: ❌ No
- **Default**: Leave empty (no default)

### 6. updatedAt (DateTime)
- **Key**: `updatedAt`
- **Type**: DateTime
- **Required**: ❌ No
- **Array**: ❌ No
- **Default**: Leave empty (no default)

## RoleChanges Collection Attributes

Go to: **Appwrite Console → Databases → Your Database → roleChanges → Attributes**

Create these attributes:

### 1. userId (String)
- **Key**: `userId`
- **Type**: String
- **Size**: 255
- **Required**: ✅ Yes
- **Array**: ❌ No
- **Default**: Leave empty
- **Unique**: ❌ No

### 2. changedBy (String)
- **Key**: `changedBy`
- **Type**: String
- **Size**: 255
- **Required**: ✅ Yes
- **Array**: ❌ No
- **Default**: Leave empty
- **Unique**: ❌ No

### 3. oldRoles (String Array)
- **Key**: `oldRoles`
- **Type**: String
- **Size**: 255
- **Required**: ❌ No
- **Array**: ✅ Yes
- **Default**: Leave empty
- **Unique**: ❌ No

### 4. newRoles (String Array)
- **Key**: `newRoles`
- **Type**: String
- **Size**: 255
- **Required**: ❌ No
- **Array**: ✅ Yes
- **Default**: Leave empty
- **Unique**: ❌ No

### 5. createdAt (DateTime)
- **Key**: `createdAt`
- **Type**: DateTime
- **Required**: ✅ Yes
- **Array**: ❌ No
- **Default**: Leave empty

## Important Notes

1. **Default Values**: When creating attributes in Appwrite Console, if there's a "Default" field, leave it **completely empty** (don't enter anything, not even `null` or empty string).

2. **Order Matters**: Create `userId` and `email` first (they're required and unique), then other attributes.

3. **Wait for Attributes**: After creating each attribute, wait a few seconds for it to be ready before creating the next one.

4. **Verify**: After creating all attributes, verify they exist by checking the Attributes tab.

## Making Attributes Unique (After Creation)

If you've already created `userId` or `email` attributes but they're not set as unique, you have two options:

### Option 1: Delete and Recreate (Recommended)

1. Go to **Appwrite Console → Databases → Your Database → users → Attributes**
2. Find the attribute (`userId` or `email`)
3. **Delete** it (three dots → Delete)
4. **Recreate** it with the same settings but **check "Unique"** ✅

### Option 2: Update via Appwrite Console

**Note**: Appwrite doesn't allow changing the "Unique" constraint after creation. You must delete and recreate the attribute.

**Steps:**
1. Go to **Attributes** tab
2. Click the **three dots (⋯)** next to `userId` or `email`
3. Click **Delete** → Confirm
4. Click **Create Attribute**
5. Recreate with:
   - **Key**: `userId` (or `email`)
   - **Type**: String
   - **Size**: 255
   - **Required**: ✅ Yes (for both)
   - **Array**: ❌ No
   - **Unique**: ✅ **Yes** (check this!)
   - **Default**: Leave empty
6. Click **Create**

**Important**: 
- ⚠️ **Deleting an attribute will remove all data in that column** for existing documents
- If you have existing users, you'll need to re-enter their `userId` or `email` values after recreating the attribute
- For `userId`: Make sure each user has a unique `userId` before setting it as unique
- For `email`: Make sure each user has a unique `email` before setting it as unique

## Quick Checklist

**Users Collection:**
- [ ] userId (String, 255, Required, Unique)
- [ ] email (String, 255, Required, Unique)
- [ ] name (String, 255, Optional)
- [ ] roles (String Array, 255, Optional)
- [ ] createdAt (DateTime, Required)
- [ ] updatedAt (DateTime, Optional)

**RoleChanges Collection:**
- [ ] userId (String, 255, Required)
- [ ] changedBy (String, 255, Required)
- [ ] oldRoles (String Array, 255, Optional)
- [ ] newRoles (String Array, 255, Optional)
- [ ] createdAt (DateTime, Required)

## After Manual Setup

Once all attributes are created:

1. Restart your backend server: `node index.js`
2. Test RBAC: `node test_rbac.js`
3. The system should now work correctly!

---

## Appwrite AI Prompts

If you prefer to use Appwrite AI to generate these attributes automatically, use the prompts below:

### Prompt for Users Collection

```
Create 6 attributes in "users": userId(String,255,req,unique), email(String,255,req,unique), name(String,255), roles(String,255,array), createdAt(DateTime,req), updatedAt(DateTime). No defaults.
```

### Prompt for RoleChanges Collection

```
Create 5 attributes in "roleChanges": userId(String,255,req), changedBy(String,255,req), oldRoles(String,255,array), newRoles(String,255,array), createdAt(DateTime,req). No defaults.
```

