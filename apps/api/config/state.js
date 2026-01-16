// Global in-memory state
// Used to share state between Socket.IO services, HTTP Controllers, and other modules
const agentSockets = new Map(); // agentId -> socketId
const sessionAssignments = new Map(); // sessionId -> { agentId, aiPaused }

module.exports = {
    agentSockets,
    sessionAssignments
};
