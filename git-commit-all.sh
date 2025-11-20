#!/bin/bash

# Git commit script for AI Customer Support Chat System
# Commits all changes with proper commit messages

echo "🚀 Starting git commit process..."

# Stage all changes
git add .

# Commit with detailed message
git commit -m "feat: implemented agent routing and admin panel enhancements

- Added agent routing system: user messages forward to assigned agents in real-time
- Implemented AI pause functionality when agent takes over session
- Added session filtering: active, agent_assigned, closed filters working
- Enhanced admin panel: added agent ID column, session status display
- Fixed message loading: all messages (user, bot, agent) load for all session types
- Implemented close conversation functionality
- Added session persistence: agent assignments persist across refreshes
- Fixed Appwrite query syntax issues with Query class and fallbacks
- Enhanced error handling and logging throughout the system
- Updated completion status documentation

Modules updated:
- apps/api/index.js: Agent routing, query fixes, session management
- apps/admin/src/pages/: Enhanced UI, filters, message display
- COMPLETION_STATUS.md: Updated with current progress (82% complete)"

echo "✅ Changes committed successfully!"

# Push to remote
echo "📤 Pushing to remote repository..."
git push

echo "✅ All changes pushed successfully!"

