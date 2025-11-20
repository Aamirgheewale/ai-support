# 🔧 Quick Fix: API Key Scopes Error

## The Problem
```
❌ Cannot access database: User (role: guests) missing scopes (["databases.read"])
```

Your API key doesn't have permission to access databases.

## The Solution (2 minutes)

### Step 1: Open Appwrite Console
👉 https://cloud.appwrite.io

### Step 2: Go to API Keys
1. Click **Settings** (⚙️ icon)
2. Click **API Keys**

### Step 3: Edit API Key
**Option A: Edit Existing**
- Click **three dots (⋯)** → **Update**
- Scroll to **Scopes** section
- Check ALL these boxes:
  - ✅ `databases.read`
  - ✅ `databases.write`
  - ✅ `collections.read`
  - ✅ `collections.write`
  - ✅ `documents.read`
  - ✅ `documents.write`
- Click **Update**

**Option B: Create New (Recommended)**
- Click **Create API Key**
- Name: `Chat Server Key`
- Check ALL scopes listed above
- Click **Create**
- **COPY THE KEY IMMEDIATELY** (you won't see it again!)

### Step 4: Update .env File
Open `apps/api/.env` and update:
```env
APPWRITE_API_KEY=your-new-or-updated-key-here
```

### Step 5: Test
```bash
cd apps/api
node diagnose_appwrite.js
```

You should see: ✅ All tests passed!

---

## Visual Guide

```
Appwrite Console
│
├── Settings ⚙️
│   └── API Keys
│       ├── [Your Key] → ⋯ → Update → Select Scopes ✅
│       └── Create API Key → Select Scopes → Create
│
└── Copy new key → Update .env → Test ✅
```

## Required Scopes Checklist
- [ ] `databases.read`
- [ ] `databases.write`
- [ ] `collections.read`
- [ ] `collections.write`
- [ ] `documents.read`
- [ ] `documents.write`

## Done! ✅
After this, your chats will save to Appwrite automatically.

