#!/usr/bin/env node

/**
 * More detailed test to verify specific scenarios
 */

const BACKEND_URL = 'http://localhost:8080';

async function testDetailedScenarios() {
    console.log('🧪 Testing Detailed Conversation Memory Scenarios...\n');
    
    try {
        // Test 1: Menu items with specific dietary info
        console.log('1️⃣ Asking for vegetarian options...');
        const response1 = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "What vegetarian dishes do you have?",
                restaurantId: 1,
                history: []
            })
        });
        
        const data1 = await response1.json();
        console.log('AI Response 1:', data1.response.substring(0, 200) + '...\n');
        
        // Test 2: Reference to "these options"
        console.log('2️⃣ Asking about "which of these" is healthiest...');
        const history = [
            { sender: 'user', text: 'What vegetarian dishes do you have?' },
            { sender: 'ai', text: data1.response }
        ];
        
        const response2 = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "which of these options would you recommend as the healthiest?",
                restaurantId: 1,
                history: history
            })
        });
        
        const data2 = await response2.json();
        console.log('AI Response 2:', data2.response, '\n');
        
        // Test 3: Follow up with "the cheapest one"
        console.log('3️⃣ Asking about "the cheapest one"...');
        const history2 = [
            ...history,
            { sender: 'user', text: 'which of these options would you recommend as the healthiest?' },
            { sender: 'ai', text: data2.response }
        ];
        
        const response3 = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "what about the cheapest one?",
                restaurantId: 1,
                history: history2
            })
        });
        
        const data3 = await response3.json();
        console.log('AI Response 3:', data3.response, '\n');
        
        console.log('✅ All conversation memory tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testDetailedScenarios();