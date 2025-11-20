// Test script to verify agent routing works correctly
require('dotenv').config();
const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const TEST_SESSION_ID = 'test123';
const TEST_AGENT_ID = 'agent42';

console.log('🧪 Testing Agent Routing\n');
console.log('='.repeat(60));
console.log(`Server: ${SERVER_URL}`);
console.log(`Session: ${TEST_SESSION_ID}`);
console.log(`Agent: ${TEST_AGENT_ID}\n`);

// Track events received
const eventsReceived = {
  user: [],
  agent: [],
  bot: []
};

// Create user socket
const userSocket = io(SERVER_URL, {
  transports: ['websocket']
});

userSocket.on('connect', () => {
  console.log('✅ User socket connected\n');
  
  // Step 1: Start session
  console.log('📝 Step 1: Starting session...');
  userSocket.emit('start_session', { sessionId: TEST_SESSION_ID });
});

userSocket.on('session_started', (data) => {
  console.log(`✅ Session started: ${data.sessionId}\n`);
  
  // Step 2: Connect as agent
  console.log('📝 Step 2: Connecting as agent...');
  setTimeout(() => {
    connectAgent();
  }, 500);
});

userSocket.on('bot_message', (data) => {
  eventsReceived.bot.push(data);
  console.log(`📨 Bot message received: "${data.text.substring(0, 50)}..."`);
});

userSocket.on('agent_joined', (data) => {
  console.log(`✅ Agent joined: ${data.agentId}\n`);
  
  // Step 3: Send user message after agent assignment
  setTimeout(() => {
    console.log('📝 Step 3: Sending user message (should forward to agent, NOT AI)...');
    userSocket.emit('user_message', {
      sessionId: TEST_SESSION_ID,
      text: 'This message should go to agent, not AI'
    });
  }, 500);
});

userSocket.on('user_message', (data) => {
  eventsReceived.user.push(data);
  console.log(`📨 User message echo: "${data.text}"`);
});

userSocket.on('error', (error) => {
  console.error('❌ Error:', error);
});

// Agent socket
let agentSocket = null;

function connectAgent() {
  agentSocket = io(SERVER_URL, {
    transports: ['websocket']
  });
  
  agentSocket.on('connect', () => {
    console.log('✅ Agent socket connected');
    
    // Register agent
    agentSocket.emit('agent_connect', { agentId: TEST_AGENT_ID });
  });
  
  agentSocket.on('agent_connected', (data) => {
    console.log(`✅ Agent registered: ${data.agentId}\n`);
    
    // Take over session
    console.log('📝 Step 2b: Taking over session...');
    agentSocket.emit('agent_takeover', {
      sessionId: TEST_SESSION_ID,
      agentId: TEST_AGENT_ID
    });
  });
  
  agentSocket.on('assignment', (data) => {
    console.log(`📨 Assignment notification:`, data);
  });
  
  agentSocket.on('user_message_for_agent', (data) => {
    eventsReceived.agent.push(data);
    console.log(`\n✅✅✅ SUCCESS! Agent received user message:`);
    console.log(`   Session: ${data.sessionId}`);
    console.log(`   Text: "${data.text}"`);
    console.log(`   Timestamp: ${data.ts}\n`);
    
    // Step 4: Agent replies
    setTimeout(() => {
      console.log('📝 Step 4: Agent sending reply...');
      agentSocket.emit('agent_message', {
        sessionId: TEST_SESSION_ID,
        text: 'Agent reply: I received your message!',
        agentId: TEST_AGENT_ID
      });
      
      // Wait a bit then check results
      setTimeout(() => {
        checkResults();
      }, 1000);
    }, 500);
  });
  
  agentSocket.on('error', (error) => {
    console.error('❌ Agent error:', error);
  });
}

function checkResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results:\n');
  
  console.log(`Bot messages received: ${eventsReceived.bot.length}`);
  if (eventsReceived.bot.length > 0) {
    console.log('   ⚠️  WARNING: Bot replied after agent assignment (should not happen)');
    eventsReceived.bot.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. "${msg.text.substring(0, 50)}..."`);
    });
  } else {
    console.log('   ✅ Correct: No bot messages after agent assignment');
  }
  
  console.log(`\nAgent messages received: ${eventsReceived.agent.length}`);
  if (eventsReceived.agent.length > 0) {
    console.log('   ✅ SUCCESS: Agent received user messages');
    eventsReceived.agent.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. Session: ${msg.sessionId}, Text: "${msg.text}"`);
    });
  } else {
    console.log('   ❌ FAILED: Agent did not receive user messages');
  }
  
  console.log(`\nUser message echoes: ${eventsReceived.user.length}`);
  if (eventsReceived.user.length > 0) {
    console.log('   ✅ Correct: User messages echoed to widget');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Summary
  const passed = eventsReceived.agent.length > 0 && eventsReceived.bot.length === 0;
  if (passed) {
    console.log('\n✅✅✅ TEST PASSED! ✅✅✅');
    console.log('   - Agent received user messages');
    console.log('   - AI did not reply after agent assignment');
    console.log('   - Routing works correctly!\n');
  } else {
    console.log('\n❌❌❌ TEST FAILED ❌❌❌');
    if (eventsReceived.agent.length === 0) {
      console.log('   - Agent did not receive user messages');
    }
    if (eventsReceived.bot.length > 0) {
      console.log('   - AI replied after agent assignment (should not happen)');
    }
    console.log();
  }
  
  // Cleanup
  setTimeout(() => {
    if (userSocket) userSocket.disconnect();
    if (agentSocket) agentSocket.disconnect();
    process.exit(passed ? 0 : 1);
  }, 500);
}

// Timeout safety
setTimeout(() => {
  console.log('\n⏱️  Test timeout - checking results...');
  checkResults();
}, 10000);

