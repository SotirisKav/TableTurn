/**
 * Reservation Agent - Hybrid "Agency" Architecture
 * 
 * UPGRADED IMPLEMENTATION: This agent handles final reservation creation
 * when all customer details are collected using the Think->Act->Speak pattern.
 */

import BaseAgent from './BaseAgent.js';
import { getAiPlan, generateSpokenResponse } from '../AIService.js';
import { validateToolParameters } from '../ToolService.js';
import RestaurantService from '../RestaurantService.js';

class ReservationAgent extends BaseAgent {
    constructor() {
        super(
            'ReservationAgent',
            'Reservation Booking Specialist',
            ['reservation', 'book', 'booking', 'confirm', 'create']
        );
        
        // Define specialized tools for this agent
        this.allowedTools = ['create_reservation', 'clarify_and_respond'];
    }

    /**
     * HYBRID ARCHITECTURE: Think -> Act -> Speak Loop
     */
    async processMessage(message, history = [], restaurantId = null, context = {}) {
        try {
            console.log(`📅 ${this.name} processing with Think->Act->Speak:`, message);
            
            const effectiveRestaurantId = restaurantId || 1;
            
            // STEP 1: THINK - AI selects the best tool (usually create_reservation if details complete)
            console.log('🧠 STEP 1: THINK - Getting AI plan for reservation query...');
            const toolPlan = await this.getContextAwarePlan(
                message,
                message, // Reservation agent handles the full message since it's the final step
                history, 
                context.globalContext || {},
                effectiveRestaurantId
            );
            
            console.log('🎯 AI selected tool:', toolPlan.tool_to_call, 'with parameters:', toolPlan.parameters);
            
            // Validate that the selected tool is allowed for this agent
            if (!this.allowedTools.includes(toolPlan.tool_to_call)) {
                console.warn(`⚠️ AI selected disallowed tool ${toolPlan.tool_to_call}, falling back to clarify_and_respond`);
                toolPlan.tool_to_call = 'clarify_and_respond';
                toolPlan.parameters = {
                    message: 'I handle final reservation bookings. Do you have all the details ready to confirm your reservation?'
                };
            }
            
            // STEP 2: ACT - Execute the selected tool
            console.log('⚡ STEP 2: ACT - Executing tool...');
            const toolResult = await this.executeTool(toolPlan.tool_to_call, toolPlan.parameters, effectiveRestaurantId);
            
            console.log('📊 Tool result:', toolResult);
            
            // REMOVED: STEP 3: SPEAK - Agent now returns data only, no response generation
            console.log('📊 Silent Data Collection: Returning tool result only...');
            
            // Build silent data collector response object (NO response text)
            const agentResponse = {
                toolResult: toolResult, // The raw, factual data from the "Act" step
                isTaskComplete: true, // Reservation agent usually completes the booking flow
                agent: this.name,
                timestamp: new Date().toISOString()
            };
            
            // Pass through reservation details if booking was successful
            if (toolResult.success && toolResult.reservationDetails) {
                agentResponse.reservationDetails = toolResult.reservationDetails;
                agentResponse.type = 'redirect'; // Trigger redirect to confirmation page
            }
            
            return agentResponse;
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return {
                toolResult: {
                    success: false,
                    error: error.message
                },
                isTaskComplete: true,
                error: error.message,
                agent: this.name
            };
        }
    }

    /**
     * PHASE 2: Context-Aware and Focused Planning for Reservation Specialist
     */
    async getContextAwarePlan(originalMessage, specificTask, history, globalContext, restaurantId) {
        try {
            console.log('🧠 Context-aware planning for ReservationAgent...');
            console.log('🌐 Global context available:', Object.keys(globalContext));
            
            const focusedPrompt = this.buildFocusedThinkingPrompt(
                originalMessage, 
                specificTask, 
                history, 
                globalContext
            );
            
            const { getAiPlan } = await import('../AIService.js');
            const toolPlan = await getAiPlan(
                focusedPrompt,
                [],
                { allowedTools: this.allowedTools },
                restaurantId
            );
            
            if (!this.allowedTools.includes(toolPlan.tool_to_call)) {
                console.warn(`⚠️ AI selected disallowed tool ${toolPlan.tool_to_call}, falling back to clarify_and_respond`);
                return {
                    tool_to_call: 'clarify_and_respond',
                    parameters: {
                        message: 'I handle final reservation bookings. Do you have all the details ready to confirm your reservation?'
                    }
                };
            }
            
            return toolPlan;
            
        } catch (error) {
            console.error('❌ Error in context-aware planning:', error);
            return {
                tool_to_call: 'clarify_and_respond',
                parameters: {
                    message: 'I need all reservation details to complete your booking.'
                }
            };
        }
    }

    /**
     * Build the focused thinking prompt for reservation specialist
     */
    buildFocusedThinkingPrompt(originalMessage, specificTask, history, globalContext) {
        const contextSummary = this.summarizeGlobalContext(globalContext);
        const recentHistory = history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n');
        const availabilityInfo = this.extractAvailabilityFromContext(globalContext);
        
        return `You are a reservation creation specialist agent. Your job is to analyze the user's request and choose the best tool from your limited tool belt.

GLOBAL CONTEXT (What other agents have already done):
${contextSummary}

AVAILABILITY CONTEXT: ${availabilityInfo}

USER'S FULL ORIGINAL REQUEST: "${originalMessage}"

YOUR SPECIFIC TASK: "${specificTask}"

YOUR ALLOWED TOOLS: ${JSON.stringify(this.allowedTools)}

RECENT CONVERSATION HISTORY:
${recentHistory || 'None'}

CRITICAL DECISION RULES:
1. Use create_reservation ONLY if you have ALL required details: name, email, phone, date, time, partySize, tableType
2. Use clarify_and_respond if ANY required detail is missing
3. Check the global context and conversation history to see what details have been collected
4. If availability hasn't been checked or table type hasn't been selected, ask for that first

REQUIRED FIELDS FOR create_reservation:
- name (customer's full name)
- email (customer's email) 
- phone (customer's phone number)
- date (YYYY-MM-DD format)
- time (HH:MM format)
- partySize (number of people)
- tableType (must match available table types from availability check)

INSTRUCTIONS:
1. Analyze if ALL required fields are available from the context and conversation
2. If yes, use create_reservation with all the collected details
3. If no, use clarify_and_respond to ask for missing information
4. Do NOT create a reservation without complete information

Respond ONLY with a JSON object: { "tool_to_call": "...", "parameters": {...} }`;
    }

    /**
     * Extract availability information from global context
     */
    extractAvailabilityFromContext(globalContext) {
        for (const [agent, result] of Object.entries(globalContext)) {
            if (result && result.available !== undefined) {
                if (result.available && result.availableTableTypes) {
                    const tableOptions = result.availableTableTypes.map(t => t.tableType).join(', ');
                    return `Availability confirmed for ${result.partySize} people on ${result.date} at ${result.time}. Available tables: ${tableOptions}`;
                } else {
                    return `No availability found for requested time`;
                }
            }
        }
        return 'No availability information in context';
    }

    /**
     * Summarize what other agents have already accomplished
     */
    summarizeGlobalContext(globalContext) {
        if (!globalContext || Object.keys(globalContext).length === 0) {
            return 'No other agents have processed this request yet.';
        }
        
        const summaries = [];
        for (const [agent, result] of Object.entries(globalContext)) {
            if (result && result.success) {
                if (result.available !== undefined) {
                    summaries.push(`${agent}: Checked availability - ${result.available ? 'tables available' : 'no availability'}`);
                } else if (result.items && result.items.length > 0) {
                    summaries.push(`${agent}: Found ${result.items.length} menu items`);
                } else if (result.packages && result.packages.length > 0) {
                    summaries.push(`${agent}: Found ${result.packages.length} celebration packages`);
                } else if (result.restaurant) {
                    summaries.push(`${agent}: Retrieved restaurant information`);
                } else {
                    summaries.push(`${agent}: Completed successfully`);
                }
            } else {
                summaries.push(`${agent}: ${result?.error || 'Task failed'}`);
            }
        }
        
        return summaries.length > 0 ? summaries.join('\n') : 'No other agents have processed this request yet.';
    }

    /**
     * EXECUTE TOOL: Direct tool execution within this agent's domain
     */
    async executeTool(toolName, parameters, restaurantId) {
        try {
            // Validate parameters
            const validation = validateToolParameters(toolName, parameters);
            if (!validation.success) {
                console.error('❌ Tool parameter validation failed:', validation.errors);
                return {
                    success: false,
                    error: `Invalid parameters: ${validation.errors.join(', ')}`
                };
            }
            
            console.log(`🔧 Executing tool: ${toolName} with params:`, parameters);
            
            switch (toolName) {
                case 'create_reservation':
                    return await this.executeCreateReservation(parameters, restaurantId);
                    
                case 'clarify_and_respond':
                    return await this.executeClarifyAndRespond(parameters);
                    
                default:
                    console.error('❌ Unknown tool for ReservationAgent:', toolName);
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
     * Execute create_reservation tool - Core functionality
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
}

export default ReservationAgent;