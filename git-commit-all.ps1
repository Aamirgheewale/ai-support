# Git commit script for AI Customer Support Chat System (PowerShell)
# Commits all changes with proper commit messages

Write-Host "🚀 Starting git commit process..." -ForegroundColor Cyan

# Stage all changes
Write-Host "📝 Staging all changes..." -ForegroundColor Yellow
git add .

# Commit with detailed message
Write-Host "💾 Committing changes..." -ForegroundColor Yellow
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

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Changes committed successfully!" -ForegroundColor Green
    
    # Push to remote
    Write-Host "📤 Pushing to remote repository..." -ForegroundColor Yellow
    git push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ All changes pushed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to push changes. Check your git remote configuration." -ForegroundColor Red
    }
} else {
    Write-Host "❌ Failed to commit changes. Check git status." -ForegroundColor Red
}

