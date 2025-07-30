/**
 * Agent Orchestrator - Tool-Based Architecture
 * 
 * Refactored from multi-agent delegation to a centralized "Think -> Act -> Speak" loop.
 * This orchestrator now uses the AI planning system to select tools and execute them directly.
 */

import { getAiPlan, generateSpokenResponse } from '../AIService.js';
import { validateToolParameters } from '../ToolService.js';
import RestaurantService from '../RestaurantService.js';
import RAGService from '../RAGService.js';
import TimezoneUtils from '../../utils/timezoneUtils.js';
import db from '../../config/database.js';

class AgentOrchestrator {
    constructor() {
        // New tool-based architecture - no more individual agents
        this.conversationState = {
            activeFlow: null,           // 'booking', 'menu', 'info', etc.
            flowState: {},              // Data collected during the current flow
            lastToolCalled: null,       // Track the last tool for context
            lastToolResult: null        // Cache the last tool result if needed
        };
    }

    /**
     * NEW ARCHITECTURE: Think -> Act -> Speak Loop
     * 
     * This is the main entry point that implements the clean two-call architecture:
     * 1. Think: AI analyzes the message and selects the best tool
     * 2. Act: Execute the selected tool with the provided parameters  
     * 3. Speak: AI generates a natural response based on the tool results
     */
    async processMessage(message, history = [], restaurantId = null) {
        try {
            console.log('🎭 NEW ARCHITECTURE: Processing message:', message);
            
            // Ensure restaurantId has a default value
            const effectiveRestaurantId = restaurantId || 1;
            
            // STEP 1: THINK - AI selects the best tool to call
            console.log('🧠 STEP 1: THINK - Getting AI plan...');
            const toolPlan = await getAiPlan(message, history, this.conversationState, effectiveRestaurantId);
            
            console.log('🎯 AI selected tool:', toolPlan.tool_to_call, 'with parameters:', toolPlan.parameters);
            
            // STEP 2: ACT - Execute the selected tool
            console.log('⚡ STEP 2: ACT - Executing tool...');
            const toolResult = await this.executeTool(toolPlan.tool_to_call, toolPlan.parameters, effectiveRestaurantId);
            
            console.log('📊 Tool result:', toolResult);
            
            // Update conversation state based on tool execution
            this.updateConversationState(toolPlan.tool_to_call, toolPlan.parameters, toolResult);
            
            // STEP 3: SPEAK - AI generates natural response
            console.log('🗣️ STEP 3: SPEAK - Generating response...');
            const spokenResponse = await generateSpokenResponse(
                message, 
                toolResult, 
                toolPlan.tool_to_call, 
                effectiveRestaurantId
            );
            
            console.log('✅ Final response:', spokenResponse);
            
            // Add orchestrator metadata for consistency with existing system
            return {
                ...spokenResponse,
                orchestrator: {
                    toolUsed: toolPlan.tool_to_call,
                    conversationState: this.conversationState,
                    timestamp: new Date().toISOString(),
                    architecture: 'tool-based'
                }
            };
            
        } catch (error) {
            console.error('❌ Agent Orchestrator error:', error);
            return {
                response: "I apologize, but I'm having trouble processing your request right now. Please try again.",
                type: 'message',
                orchestrator: {
                    error: error.message,
                    architecture: 'tool-based'
                }
            };
        }
    }

    /**
     * EXECUTE TOOL: Simple switch statement that calls appropriate service functions
     * 
     * This is a direct mapping of tool calls to existing service functions.
     * Each tool execution is translated to the corresponding service method.
     */
    async executeTool(toolName, parameters, restaurantId) {
        try {
            // Preprocess parameters to handle common formats
            const processedParams = this.preprocessParameters(toolName, parameters);
            
            // Validate parameters after preprocessing
            const validation = validateToolParameters(toolName, processedParams);
            if (!validation.success) {
                console.error('❌ Tool parameter validation failed:', validation.errors);
                return {
                    success: false,
                    error: `Invalid parameters: ${validation.errors.join(', ')}`
                };
            }
            
            console.log(`🔧 Executing tool: ${toolName} with params:`, processedParams);
            
            switch (toolName) {
                case 'check_availability':
                    return await this.executeCheckAvailability(processedParams, restaurantId);
                    
                case 'get_menu_items':
                    return await this.executeGetMenuItems(processedParams, restaurantId);
                    
                case 'get_restaurant_info':
                    return await this.executeGetRestaurantInfo(processedParams, restaurantId);
                    
                case 'create_reservation':
                    return await this.executeCreateReservation(processedParams, restaurantId);
                    
                case 'clarify_and_respond':
                    return await this.executeClarifyAndRespond(processedParams);
                    
                default:
                    console.error('❌ Unknown tool:', toolName);
                    return {
                        success: false,
                        error: `Unknown tool: ${toolName}`
                    };
            }
            
        } catch (error) {
            console.error(`❌ Error executing tool ${toolName}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * TOOL EXECUTION METHODS
     * Each method directly calls the appropriate service functions
     */
    
    /**
     * Execute check_availability tool
     */
    async executeCheckAvailability(params, restaurantId) {
        try {
            console.log('🔍 Checking availability:', params);
            
            // Get available table types for the specific time
            const availableTableTypes = await RestaurantService.getAvailableTableTypesForTime({
                restaurantId: restaurantId,
                reservationDate: params.date,
                reservationTime: params.time,
                guests: params.partySize
            });
            
            if (availableTableTypes && availableTableTypes.length > 0) {
                // Format table options for the AI response
                const tableOptions = availableTableTypes.map(t => ({
                    tableType: t.table_type,
                    price: t.table_price || '0.00',
                    capacity: t.capacity
                }));
                
                return {
                    success: true,
                    available: true,
                    availableTableTypes: tableOptions,
                    hasMultipleTableTypes: tableOptions.length > 1,
                    date: params.date,
                    time: params.time,
                    partySize: params.partySize
                };
            } else {
                return {
                    success: true,
                    available: false,
                    message: `No tables available for ${params.partySize} people on ${this.formatDate(params.date)} at ${this.formatTime(params.time)}`,
                    date: params.date,
                    time: params.time,
                    partySize: params.partySize
                };
            }
            
        } catch (error) {
            console.error('❌ Error checking availability:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Execute get_menu_items tool
     */
    async executeGetMenuItems(params, restaurantId) {
        try {
            console.log('🍽️ Getting menu items:', params);
            
            // Build filters object
            const filters = { restaurant_id: restaurantId };
            if (params.is_gluten_free) filters.is_gluten_free = true;
            if (params.is_vegan) filters.is_vegan = true;  
            if (params.is_vegetarian) filters.is_vegetarian = true;
            if (params.category) filters.category = params.category;
            
            // Use RAG service for semantic search
            const hybridResults = await RAGService.hybridSearch(
                params.query,
                'menu_item',
                filters,
                10
            );
            
            // Also get regular menu items as fallback
            const regularMenuItems = await RestaurantService.getMenuItems(restaurantId);
            
            return {
                success: true,
                items: hybridResults.length > 0 ? hybridResults : regularMenuItems || [],
                searchQuery: params.query,
                filtersApplied: filters
            };
            
        } catch (error) {
            console.error('❌ Error getting menu items:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Execute get_restaurant_info tool
     */
    async executeGetRestaurantInfo(params, restaurantId) {
        try {
            console.log('🏪 Getting restaurant info:', params);
            
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            if (!restaurant) {
                return {
                    success: false,
                    error: 'Restaurant not found'
                };
            }
            
            const result = { success: true, restaurant };
            
            // Add specific information based on topic
            switch (params.topic) {
                case 'hours':
                    result.hours = await RestaurantService.getRestaurantHours(restaurantId);
                    break;
                case 'address':
                    result.address = {
                        full: restaurant.address,
                        area: restaurant.area,
                        location: restaurant.location
                    };
                    break;
                case 'description':
                    result.description = restaurant.description;
                    result.cuisine = restaurant.cuisine;
                    break;
                case 'general':
                default:
                    result.hours = await RestaurantService.getRestaurantHours(restaurantId);
                    result.address = {
                        full: restaurant.address,
                        area: restaurant.area,
                        location: restaurant.location
                    };
                    result.description = restaurant.description;
                    result.cuisine = restaurant.cuisine;
                    break;
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Error getting restaurant info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Execute create_reservation tool
     */
    async executeCreateReservation(params, restaurantId) {
        try {
            console.log('📅 Creating reservation:', params);
            
            // Prepare reservation data for the service
            const reservationData = {
                venueId: restaurantId,
                reservationName: params.name,
                reservationEmail: params.email,
                reservationPhone: params.phone,
                date: params.date,
                time: params.time,
                guests: params.partySize,
                tableType: params.tableType,
                celebrationType: null,
                cake: false,
                cakePrice: 0,
                flowers: false,
                flowersPrice: 0,
                hotelName: null,
                hotelId: null,
                specialRequests: params.specialRequests || null
            };
            
            // Create the reservation
            const createdReservation = await RestaurantService.createReservation(reservationData);
            
            return {
                success: true,
                reservationDetails: {
                    reservationId: createdReservation.reservation_id,
                    restaurant: restaurantId,
                    name: params.name,
                    email: params.email,
                    phone: params.phone,
                    date: params.date,
                    time: params.time,
                    partySize: params.partySize,
                    tableType: params.tableType,
                    specialRequests: params.specialRequests,
                    success: true
                }
            };
            
        } catch (error) {
            console.error('❌ Error creating reservation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Execute clarify_and_respond tool
     */
    async executeClarifyAndRespond(params) {
        try {
            console.log('❓ Clarifying and responding:', params);
            
            return {
                success: true,
                message: params.message,
                responseType: params.response_type || 'clarification'
            };
            
        } catch (error) {
            console.error('❌ Error in clarify and respond:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Update conversation state based on tool execution
     */
    updateConversationState(toolName, parameters, toolResult) {
        try {
            this.conversationState.lastToolCalled = toolName;
            this.conversationState.lastToolResult = toolResult;
            
            // Update flow state based on tool and results
            switch (toolName) {
                case 'check_availability':
                    this.conversationState.activeFlow = 'booking';
                    this.conversationState.flowState = {
                        ...this.conversationState.flowState,
                        date: parameters.date,
                        time: parameters.time,
                        partySize: parameters.partySize,
                        availabilityChecked: true,
                        availableTableTypes: toolResult.availableTableTypes || []
                    };
                    break;
                    
                case 'create_reservation':
                    if (toolResult.success) {
                        this.conversationState.activeFlow = 'completed';
                        this.conversationState.flowState = {
                            ...this.conversationState.flowState,
                            reservationCreated: true,
                            reservationId: toolResult.reservationDetails?.reservationId
                        };
                    }
                    break;
                    
                case 'get_menu_items':
                    this.conversationState.activeFlow = 'menu';
                    break;
                    
                case 'get_restaurant_info':
                    this.conversationState.activeFlow = 'info';
                    break;
                    
                default:
                    // For clarify_and_respond and other tools, keep current state
                    break;
            }
            
            console.log('📊 Updated conversation state:', this.conversationState);
            
        } catch (error) {
            console.error('❌ Error updating conversation state:', error);
        }
    }

    /**
     * Preprocess parameters to handle common formats and conversions
     */
    preprocessParameters(toolName, parameters) {
        const processedParams = { ...parameters };
        
        switch (toolName) {
            case 'check_availability':
                // Ensure partySize is a number
                if (processedParams.partySize && typeof processedParams.partySize === 'string') {
                    processedParams.partySize = parseInt(processedParams.partySize, 10);
                }
                break;
                
            case 'get_menu_items':
                // Ensure boolean flags are properly set
                if (processedParams.is_gluten_free === undefined) processedParams.is_gluten_free = false;
                if (processedParams.is_vegan === undefined) processedParams.is_vegan = false;
                if (processedParams.is_vegetarian === undefined) processedParams.is_vegetarian = false;
                break;
                
            case 'create_reservation':
                // Ensure partySize is a number
                if (processedParams.partySize && typeof processedParams.partySize === 'string') {
                    processedParams.partySize = parseInt(processedParams.partySize, 10);
                }
                break;
                
            case 'get_restaurant_info':
                // Set default topic if not provided
                if (!processedParams.topic) {
                    processedParams.topic = 'general';
                }
                break;
                
            case 'clarify_and_respond':
                // Set default response_type if not provided
                if (!processedParams.response_type) {
                    processedParams.response_type = 'clarification';
                }
                break;
                
            default:
                // No preprocessing needed for unknown tools
                break;
        }
        
        return processedParams;
    }
    
    /**
     * Utility methods
     */
    formatDate(dateString) {
        return TimezoneUtils.formatDateForDisplay(dateString);
    }
    
    formatTime(timeString) {
        return TimezoneUtils.formatTimeForDisplay(timeString);
    }
    
    /**
     * Get current conversation state (for debugging/monitoring)
     */
    getConversationState() {
        return { ...this.conversationState };
    }
    
    /**
     * Reset conversation state (useful for new conversations)
     */
    resetConversationState() {
        this.conversationState = {
            activeFlow: null,
            flowState: {},
            lastToolCalled: null,
            lastToolResult: null
        };
    }
}

export default AgentOrchestrator;
