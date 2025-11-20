# What's Stored in the Sessions Collection?

The `sessions` collection stores metadata about each chat session. Here's what you'll see:

## Session Fields Explained

### Core Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **sessionId** | String | Unique identifier for the chat session | `s_1763614351136` |
| **status** | String | Current state of the session | `active`, `agent_assigned`, `closed` |
| **lastSeen** | DateTime | When the user was last active | `2024-12-15T14:30:45.123Z` |
| **needsHuman** | Boolean | Whether session needs human agent | `false` or `true` |
| **assignedAgent** | String | ID of assigned human agent (if any) | `agent_123` or `null` |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| **userMeta** | String (JSON) | Additional user information | Browser, location, device info |
| **theme** | String (JSON) | Custom theme settings | Colors, styles for chat widget |
| **createdAt** | DateTime | When session was created | Auto-generated timestamp |

## What You'll See in Practice

### Example Session Document:

```json
{
  "$id": "s_1763614351136",
  "sessionId": "s_1763614351136",
  "status": "active",
  "lastSeen": "2024-12-15T14:30:45.123Z",
  "needsHuman": false,
  "assignedAgent": null,
  "userMeta": "{\"browser\":\"Chrome\",\"device\":\"Desktop\"}",
  "theme": "{}",
  "$createdAt": "2024-12-15T14:25:10.000Z"
}
```

## How to View Sessions

### Method 1: Run View Script (Recommended)

```bash
cd apps/api
node view_sessions.js
```

This shows:
- ✅ All sessions with details
- ✅ Last seen time (human-readable)
- ✅ Message count per session
- ✅ Summary statistics

### Method 2: Appwrite Console

1. Go to: https://cloud.appwrite.io
2. Navigate to: **Databases** → Your Database → `sessions` collection
3. Click **Documents** tab
4. View all session documents

### Method 3: Admin API

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  http://localhost:4000/admin/sessions
```

## Common Use Cases

### 1. **Track Active Sessions**
- See which users are currently chatting
- Monitor `lastSeen` to find inactive sessions
- Filter by `status: "active"`

### 2. **Identify Sessions Needing Help**
- Filter by `needsHuman: true`
- These are sessions where AI couldn't help
- Assign to human agents

### 3. **Agent Management**
- See which sessions are assigned to agents
- Filter by `assignedAgent` ID
- Track agent workload

### 4. **Session Analytics**
- Count total sessions
- Track session duration (createdAt to lastSeen)
- Monitor session status changes

## Session Lifecycle

1. **Session Created**
   - When user opens chat widget
   - `status: "active"`
   - `needsHuman: false`
   - `assignedAgent: null`

2. **User Chats**
   - `lastSeen` updates on each message
   - Messages stored in `messages` collection

3. **AI Escalates** (if needed)
   - `needsHuman: true`
   - System flags for agent assignment

4. **Agent Takes Over** (if assigned)
   - `status: "agent_assigned"`
   - `assignedAgent: "agent_123"`
   - `needsHuman: false`

5. **Session Ends**
   - `status: "closed"` (optional)
   - Session remains in database for history

## Relationship with Messages

Each session can have multiple messages:

```
Session (s_123)
├── Message 1: "Hello" (user)
├── Message 2: "Hi there!" (bot)
├── Message 3: "I need help" (user)
└── Message 4: "How can I help?" (bot)
```

**To see messages for a session:**
```bash
# View messages for specific session
node verify_chats_stored.js
# Or use admin API
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  http://localhost:4000/admin/sessions/s_123/messages
```

## Quick Commands

```bash
# View all sessions
node view_sessions.js

# View all messages
node verify_chats_stored.js

# View specific session details
# (Edit view_sessions.js to filter by sessionId)
```

## Summary

The **sessions** collection stores:
- ✅ **Who** is chatting (sessionId)
- ✅ **When** they were active (lastSeen)
- ✅ **Status** of the session (active, assigned, etc.)
- ✅ **Whether** they need human help (needsHuman)
- ✅ **Which agent** is handling them (assignedAgent)
- ✅ **Additional info** (userMeta, theme)

Think of it as the "metadata" table, while `messages` is the "content" table!

