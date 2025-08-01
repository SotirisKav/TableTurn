/**
 * Base Agent Class
 * Common functionality for all specialized agents
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import RAGService from '../RAGService.js';

class BaseAgent {
    constructor(name, role, capabilities) {
        this.name = name;
        this.role = role;
        this.capabilities = capabilities;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    }

    /**
     * Abstract method - must be implemented by subclasses
     */
    async processMessage(message, history, restaurantId, context) {
        throw new Error(`processMessage must be implemented by ${this.name}`);
    }

    /**
     * Generate AI response using Gemini with RAG context
     */
    async generateResponse(prompt, systemPrompt, ragData = null) {
        try {
            let enhancedPrompt = systemPrompt;
            
            // Add RAG context if available
            if (ragData) {
                const contextSummary = RAGService.generateContextSummary(ragData);
                enhancedPrompt += `\n\nCONTEXT FROM RAG RETRIEVAL:\n${contextSummary}\nRetrieval Confidence: ${ragData.retrievalContext?.confidence || 'N/A'}\n`;
            }
            
            enhancedPrompt += `\n\nUser message: ${prompt}`;
            
            const result = await this.model.generateContent(enhancedPrompt);
            return result.response.text();
        } catch (error) {
            console.error(`❌ ${this.name} AI generation error:`, error);
            throw error;
        }
    }

    /**
     * Retrieve relevant data using RAG
     */
    async retrieveRAGData(query, restaurantId) {
        try {
            console.log(`🔍 ${this.name} retrieving RAG data for: "${query}"`);
            
            // Defensive check for null restaurantId
            if (!restaurantId) {
                console.warn(`⚠️ ${this.name} received null restaurantId, using fallback`);
                // Don't proceed with RAG if we don't have a restaurant ID
                return {
                    restaurant: null,
                    entities: {},
                    query: query
                };
            }
            
            return await RAGService.retrieveContextForQuery(query, restaurantId);
        } catch (error) {
            console.error(`❌ ${this.name} RAG retrieval error:`, error);
            
            // Try to get basic restaurant info at least
            try {
                const RestaurantService = (await import('../RestaurantService.js')).default;
                const effectiveRestaurantId = restaurantId || 1;
                const restaurant = await RestaurantService.getRestaurantById(effectiveRestaurantId);
                
                console.log(`🔄 ${this.name} fallback: Retrieved basic restaurant info`);
                return {
                    restaurant,
                    entities: {},
                    query: query,
                    fallbackMode: true
                };
                
            } catch (fallbackError) {
                console.error(`❌ ${this.name} fallback also failed:`, fallbackError);
                return {
                    restaurant: null,
                    entities: {},
                    query: query,
                    fallbackFailed: true
                };
            }
        }
    }

    /**
     * Build conversation history for context
     */
    buildConversationHistory(history) {
        if (!history || history.length === 0) {
            console.log('📝 No conversation history available');
            return '';
        }
        
        console.log(`📝 Building conversation history from ${history.length} messages`);
        
        const formattedHistory = history.map((msg) => {
            if (msg.sender === 'user') {
                return `Human: ${msg.text || msg.message}`;
            } else if (msg.sender === 'ai') {
                return `Assistant: ${msg.text || msg.response}`;
            } else {
                // Fallback for different formats
                return `Human: ${msg.message || msg.text}\nAssistant: ${msg.response || ''}`;
            }
        }).filter(line => line.trim()).join('\n\n');
        
        console.log('📝 Formatted conversation history preview:', formattedHistory.substring(0, 200) + '...');
        return formattedHistory;
    }

    /**
     * Extract structured data from AI response
     */
    extractStructuredData(response, dataType) {
        const startMarker = `[${dataType.toUpperCase()}_DATA]`;
        const endMarker = `[/${dataType.toUpperCase()}_DATA]`;
        
        let startIndex = response.indexOf(startMarker);
        let endIndex = response.indexOf(endMarker);
        
        // Handle case where AI might put markers in wrong order
        if (startIndex === -1 && endIndex !== -1) {
            // Look for the pattern after the closing marker (malformed response)
            const afterClosing = response.substring(endIndex + endMarker.length);
            const jsonMatch = afterClosing.match(/\s*(\{[\s\S]*?\})\s*/);
            if (jsonMatch) {
                let dataStr = jsonMatch[1].trim();
                console.log('🔧 Found malformed structured data, attempting to parse...');
                
                // Clean up common JSON parsing issues
                dataStr = dataStr
                    .replace(/:\s*undefined/g, ': null')
                    .replace(/,\s*undefined/g, ', null')
                    .replace(/undefined/g, 'null');
                
                try {
                    return JSON.parse(dataStr);
                } catch (error) {
                    console.error(`❌ Failed to parse malformed ${dataType} data:`, error);
                    console.error(`❌ Problematic JSON string:`, dataStr);
                    return null;
                }
            }
        }
        
        if (startIndex === -1 || endIndex === -1) {
            return null;
        }
        
        let dataStr = response.substring(
            startIndex + startMarker.length, 
            endIndex
        ).trim();
        
        // Clean up common JSON parsing issues
        dataStr = dataStr
            .replace(/:\s*undefined/g, ': null')
            .replace(/,\s*undefined/g, ', null')
            .replace(/undefined/g, 'null');
        
        try {
            return JSON.parse(dataStr);
        } catch (error) {
            console.error(`❌ Failed to parse ${dataType} data:`, error);
            console.error(`❌ Problematic JSON string:`, dataStr);
            return null;
        }
    }

    /**
     * Clean response by removing structured data blocks
     */
    cleanResponse(response) {
        // Remove properly formatted data blocks
        let cleaned = response.replace(/\[[A-Z_]+_DATA\][\s\S]*?\[\/[A-Z_]+_DATA\]/g, '');
        
        // Remove malformed data blocks (closing tag first, then JSON)
        cleaned = cleaned.replace(/\[\/[A-Z_]+_DATA\]\s*\{[^}]*\}[^[]*\[[A-Z_]+_DATA\]/g, '');
        
        // Remove any remaining structured data patterns
        cleaned = cleaned.replace(/\[\/[A-Z_]+_DATA\]\s*\{[\s\S]*?\}/g, '');
        
        // Clean up multiple newlines
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        return cleaned.trim();
    }

    /**
     * Format response with agent metadata
     */
    formatResponse(response, type = 'message', additionalData = {}) {
        return {
            type,
            response: this.cleanResponse(response),
            timestamp: new Date().toISOString(),
            agent: this.name,
            ...additionalData
        };
    }

    /**
     * Check if this agent can handle the given intent
     */
    canHandle(intent) {
        return this.capabilities.includes(intent);
    }

    /**
     * Suggest handoff to another agent
     */
    suggestHandoff(targetAgent, message, context = {}, restaurantId = null, history = null) {
        return {
            handoff: {
                agent: targetAgent,
                message,
                context,
                restaurantId,
                history,
                reason: `${this.name} suggests handoff to ${targetAgent}`
            }
        };
    }

    /**
     * Get agent information
     */
    getInfo() {
        return {
            name: this.name,
            role: this.role,
            capabilities: this.capabilities
        };
    }
}

export default BaseAgent;