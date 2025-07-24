/**
 * Agent Configuration
 * Central configuration for the multi-agent system
 */

export const AGENT_CONFIG = {
    // Global settings
    DEFAULT_MODEL: "gemini-2.0-flash-exp",
    CONVERSATION_CONTEXT_LIMIT: 10, // Last N messages to include in context
    INTENT_CONFIDENCE_THRESHOLD: 0.5,
    
    // Agent definitions
    AGENTS: {
        restaurant: {
            name: 'RestaurantInfoAgent',
            priority: 1,
            capabilities: ['restaurant', 'info', 'hours', 'atmosphere', 'description'],
            handoffRules: {
                'reservation': ['book', 'reserve', 'table', 'available'],
                'menu': ['menu', 'dish', 'food', 'price', 'eat'],
                'location': ['location', 'address', 'directions'],
                'celebration': ['birthday', 'anniversary', 'special'],
                'support': ['help', 'problem', 'contact', 'owner']
            }
        },
        
        reservation: {
            name: 'ReservationAgent',
            priority: 5,
            capabilities: ['reservation', 'booking', 'table', 'available', 'date', 'time'],
            handoffRules: {
                'celebration': ['birthday', 'anniversary', 'celebration', 'special', 'cake', 'flowers'],
                'location': ['transfer', 'pickup', 'transport'],
                'menu': ['what food', 'menu', 'dishes']
            }
        },
        
        menu: {
            name: 'MenuPricingAgent',
            priority: 3,
            capabilities: ['menu', 'food', 'dish', 'price', 'cost', 'diet', 'cuisine'],
            handoffRules: {
                'reservation': ['book', 'reserve', 'sounds good', 'want to book'],
                'restaurant': ['about restaurant', 'atmosphere', 'location']
            }
        },
        
        location: {
            name: 'LocationTransferAgent',
            priority: 2,
            capabilities: ['location', 'address', 'transfer', 'transport', 'directions', 'pickup'],
            handoffRules: {
                'reservation': ['book', 'reserve', 'table'],
                'restaurant': ['about restaurant', 'hours', 'info']
            }
        },
        
        celebration: {
            name: 'CelebrationAgent',
            priority: 4,
            capabilities: ['celebration', 'birthday', 'anniversary', 'special', 'romantic', 'cake', 'flowers'],
            handoffRules: {
                'reservation': ['book', 'reserve', 'table', 'sounds perfect', 'lets do it']
            }
        },
        
        support: {
            name: 'SupportContactAgent',
            priority: 6,
            capabilities: ['support', 'help', 'contact', 'owner', 'manager', 'problem', 'issue'],
            handoffRules: {
                'reservation': ['booking problem', 'reservation issue'],
                'restaurant': ['restaurant info', 'general question']
            }
        }
    },
    
    // Intent analysis patterns
    INTENT_PATTERNS: {
        reservation: {
            keywords: [
                'book', 'reserve', 'table', 'reservation', 'available', 'date', 'time',
                'party', 'people', 'guests', 'confirm', 'booking', 'seat'
            ],
            weight: 2.0
        },
        
        menu: {
            keywords: [
                'menu', 'dish', 'food', 'eat', 'price', 'cost', 'order', 'meal',
                'vegetarian', 'vegan', 'gluten', 'diet', 'cuisine', 'speciality',
                'what do you serve', 'dishes'
            ],
            weight: 1.8
        },
        
        celebration: {
            keywords: [
                'birthday', 'anniversary', 'celebration', 'special', 'occasion',
                'cake', 'flower', 'surprise', 'romantic', 'proposal', 'wedding'
            ],
            weight: 2.2
        },
        
        location: {
            keywords: [
                'location', 'address', 'transfer', 'transport', 'pickup',
                'airport', 'hotel', 'directions', 'how to get', 'where',
                'taxi', 'bus', 'car'
            ],
            weight: 1.5
        },
        
        restaurant: {
            keywords: [
                'about', 'info', 'hours', 'open', 'close', 'atmosphere',
                'style', 'rating', 'review', 'description', 'tell me about'
            ],
            weight: 1.0
        },
        
        support: {
            keywords: [
                'help', 'contact', 'owner', 'manager', 'phone', 'email',
                'problem', 'issue', 'complaint', 'question', 'assistance'
            ],
            weight: 1.3
        }
    },
    
    // Conversation state management
    STATE_CONFIG: {
        MAX_CONTEXT_AGE: 30 * 60 * 1000, // 30 minutes in milliseconds
        CLEANUP_INTERVAL: 5 * 60 * 1000,  // 5 minutes in milliseconds
        MAX_ACTIVE_SESSIONS: 1000
    },
    
    // Logging and monitoring
    LOGGING: {
        LOG_AGENT_SWITCHES: true,
        LOG_INTENT_ANALYSIS: true,
        LOG_CONVERSATION_STATE: false,
        LOG_PERFORMANCE_METRICS: true
    },
    
    // Performance settings
    PERFORMANCE: {
        RESPONSE_TIMEOUT: 30000, // 30 seconds
        MAX_RETRIES: 3,
        CACHE_RESTAURANT_DATA: true,
        CACHE_TTL: 10 * 60 * 1000 // 10 minutes
    }
};

// Helper functions for configuration
export class AgentConfigHelper {
    static getAgentByName(agentName) {
        return Object.values(AGENT_CONFIG.AGENTS).find(agent => agent.name === agentName);
    }
    
    static getAgentCapabilities(agentType) {
        return AGENT_CONFIG.AGENTS[agentType]?.capabilities || [];
    }
    
    static getHandoffRules(agentType) {
        return AGENT_CONFIG.AGENTS[agentType]?.handoffRules || {};
    }
    
    static getIntentKeywords(intent) {
        return AGENT_CONFIG.INTENT_PATTERNS[intent]?.keywords || [];
    }
    
    static getIntentWeight(intent) {
        return AGENT_CONFIG.INTENT_PATTERNS[intent]?.weight || 1.0;
    }
    
    static shouldLogAgentSwitches() {
        return AGENT_CONFIG.LOGGING.LOG_AGENT_SWITCHES;
    }
    
    static shouldLogIntentAnalysis() {
        return AGENT_CONFIG.LOGGING.LOG_INTENT_ANALYSIS;
    }
    
    static getResponseTimeout() {
        return AGENT_CONFIG.PERFORMANCE.RESPONSE_TIMEOUT;
    }
    
    static getMaxRetries() {
        return AGENT_CONFIG.PERFORMANCE.MAX_RETRIES;
    }
}

export default AGENT_CONFIG;