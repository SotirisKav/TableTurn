/**
 * Test Script for New Tool-Based Architecture
 * 
 * This script tests the new "Think -> Act -> Speak" architecture to ensure
 * that the conversational flows are preserved after the refactor.
 */

import AgentOrchestrator from './services/agents/AgentOrchestrator.js';

async function testNewArchitecture() {
    console.log('🧪 Testing New Tool-Based Architecture');
    console.log('=====================================\n');
    
    const orchestrator = new AgentOrchestrator();
    const restaurantId = 1; // Test with restaurant ID 1
    
    // Test scenarios to verify the architecture works
    const testScenarios = [
        {
            name: 'Basic greeting',
            message: 'Hello',
            history: []
        },
        {
            name: 'Restaurant info query',
            message: 'What are your hours?',
            history: []
        },
        {
            name: 'Menu inquiry',
            message: 'What vegetarian dishes do you have?',
            history: []
        },
        {
            name: 'Availability check',
            message: 'Do you have a table for 2 people tomorrow at 7pm?',
            history: []
        }
    ];
    
    for (const scenario of testScenarios) {
        try {
            console.log(`\n📋 Test: ${scenario.name}`);
            console.log(`💬 User: ${scenario.message}`);
            console.log('⏳ Processing...\n');
            
            const result = await orchestrator.processMessage(
                scenario.message,
                scenario.history,
                restaurantId
            );
            
            console.log('✅ Response received:');
            console.log(`🤖 AI: ${result.response}`);
            console.log(`📊 Type: ${result.type}`);
            console.log(`🔧 Tool Used: ${result.orchestrator?.toolUsed || 'N/A'}`);
            console.log(`🏗️ Architecture: ${result.orchestrator?.architecture || 'N/A'}`);
            
            if (result.orchestrator?.conversationState) {
                console.log(`💾 Flow State: ${JSON.stringify(result.orchestrator.conversationState.flowState, null, 2)}`);
            }
            
            console.log('─'.repeat(50));
            
        } catch (error) {
            console.error(`❌ Test failed for "${scenario.name}":`, error.message);
            console.log('─'.repeat(50));
        }
    }
    
    console.log('\n🎉 Architecture testing completed!');
    console.log('Check the results above to verify the new system is working correctly.');
}

// Prevent the script from running if imported as a module
if (import.meta.url === `file://${process.argv[1]}`) {
    testNewArchitecture().catch(console.error);
}

export default testNewArchitecture;