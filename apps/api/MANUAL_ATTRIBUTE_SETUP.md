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
- **Default**: Leave empty (don't enter anything)
- **Unique**: ⚠️ **Set via Index** (see "Making Attributes Unique" section below)

### 2. email (String)
- **Key**: `email`
- **Type**: String
- **Size**: 255
- **Required**: ✅ Yes
- **Array**: ❌ No
- **Default**: Leave empty (don't enter anything)
- **Unique**: ⚠️ **Set via Index** (see "Making Attributes Unique" section below)

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

## Making Attributes Unique (Using Indexes)

**Important**: In Appwrite, uniqueness is **NOT** set via a checkbox on the attribute. Instead, you must create a **Unique Index** on the attribute.

### Steps to Make Attributes Unique:

1. Go to **Appwrite Console → Databases → Your Database → users → Indexes** tab
2. Click **Create Index** button
3. For `userId`:
   - **Name**: `idx_userId_unique` (or any name you prefer)
   - **Attributes**: Click "Add attribute" → Select `userId`
   - **Type**: Select **"Unique"** from the dropdown
   - Click **Create**
4. Repeat for `email`:
   - **Name**: `idx_email_unique` (or any name you prefer)
   - **Attributes**: Click "Add attribute" → Select `email`
   - **Type**: Select **"Unique"** from the dropdown
   - Click **Create**

### Visual Guide:

```
Appwrite Console
│
├── Databases
│   └── Your Database
│       └── users Collection
│           ├── Attributes (create attributes here)
│           └── Indexes (create unique indexes here) ← This is where uniqueness is set!
│               └── Create Index
│                   ├── Name: idx_userId_unique
│                   ├── Attributes: userId
│                   └── Type: Unique ✅
```

### Important Notes:

- ✅ **No need to delete/recreate attributes** - just create indexes
- ✅ **Safe for existing data** - won't affect existing documents
- ✅ **Enforces uniqueness** - prevents duplicate values
- ⚠️ **Before creating unique indexes**, make sure:
  - All existing `userId` values are unique
  - All existing `email` values are unique
  - If duplicates exist, remove them first or the index creation will fail

### Verify Uniqueness:

After creating the indexes, run:
```bash
cd apps/api
node check_attribute_types.js
```

You should see:
```
✅ userId: OK
✅ email: OK
```

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

