#!/usr/bin/env node

/**
 * Test script to verify AI conversation memory and reference resolution
 * Tests the specific scenario where AI fails to remember "these 5 items"
 */

// Using native fetch (Node.js 18+)

const BACKEND_URL = 'http://localhost:8080';

async function testConversationMemory() {
    console.log('🧪 Testing AI Conversation Memory and Reference Resolution...\n');
    
    try {
        // Step 1: Ask for light healthy meal suggestions
        console.log('1️⃣ Asking for light healthy meal suggestions...');
        const firstResponse = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Can you suggest some light healthy meal options?",
                restaurantId: 1,
                history: []
            })
        });
        
        const firstData = await firstResponse.json();
        console.log('AI Response 1:', firstData.response.substring(0, 200) + '...\n');
        
        // Step 2: Ask "out of these 5, which is the cheapest"
        console.log('2️⃣ Asking about cheapest among "these 5"...');
        const history1 = [
            { sender: 'user', text: 'Can you suggest some light healthy meal options?' },
            { sender: 'ai', text: firstData.response }
        ];
        
        const secondResponse = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "out of these 5 which is the cheapest",
                restaurantId: 1,
                history: history1
            })
        });
        
        const secondData = await secondResponse.json();
        console.log('AI Response 2:', secondData.response, '\n');
        
        // Step 3: Ask "out of these 5, which is the healthiest"
        console.log('3️⃣ Asking about healthiest among "these 5"...');
        const history2 = [
            ...history1,
            { sender: 'user', text: 'out of these 5 which is the cheapest' },
            { sender: 'ai', text: secondData.response }
        ];
        
        const thirdResponse = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "out of these 5, which is the healthiest",
                restaurantId: 1,
                history: history2
            })
        });
        
        const thirdData = await thirdResponse.json();
        console.log('AI Response 3:', thirdData.response, '\n');
        
        // Analyze results
        console.log('📊 ANALYSIS:');
        const failureIndicators = [
            'which 5 items',
            'could you please list',
            'please specify',
            'what items are you referring to',
            'list the 5 items'
        ];
        
        const hasFailure = failureIndicators.some(indicator => 
            thirdData.response.toLowerCase().includes(indicator.toLowerCase())
        );
        
        if (hasFailure) {
            console.log('❌ CONVERSATION MEMORY STILL BROKEN');
            console.log('   The AI is asking for clarification instead of using conversation context');
        } else {
            console.log('✅ CONVERSATION MEMORY WORKING');
            console.log('   The AI successfully resolved "these 5" from conversation history');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testConversationMemory();