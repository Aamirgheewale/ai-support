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
Create attributes for the "users" collection in Appwrite database. Add these 6 attributes in order:

1. userId: String type, size 255, required=true, array=false, unique=true, no default value
2. email: String type, size 255, required=true, array=false, unique=true, no default value
3. name: String type, size 255, required=false, array=false, unique=false, no default value
4. roles: String type, size 255, required=false, array=true, unique=false, no default value (this is a string array)
5. createdAt: DateTime type, required=true, array=false, no default value
6. updatedAt: DateTime type, required=false, array=false, no default value

Important: Do not set any default values for any attributes. Leave default fields empty. Create attributes sequentially and wait for each to be ready before creating the next one.
```

### Prompt for RoleChanges Collection

```
Create attributes for the "roleChanges" collection in Appwrite database. Add these 5 attributes in order:

1. userId: String type, size 255, required=true, array=false, unique=false, no default value
2. changedBy: String type, size 255, required=true, array=false, unique=false, no default value
3. oldRoles: String type, size 255, required=false, array=true, unique=false, no default value (this is a string array)
4. newRoles: String type, size 255, required=false, array=true, unique=false, no default value (this is a string array)
5. createdAt: DateTime type, required=true, array=false, no default value

Important: Do not set any default values for any attributes. Leave default fields empty. Create attributes sequentially and wait for each to be ready before creating the next one.
```

