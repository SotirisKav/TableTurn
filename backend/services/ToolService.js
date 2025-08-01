/**
 * Tool Service - Tool-Based Architecture
 * 
 * This service defines all tools that the AI orchestrator can call.
 * Each tool is a direct translation of the capabilities from the existing agents:
 * - TableAvailabilityAgent -> check_availability tool
 * - MenuPricingAgent -> get_menu_items tool  
 * - RestaurantInfoAgent -> get_restaurant_info tool
 * - ReservationAgent -> create_reservation tool
 * - Fallback -> clarify_and_respond tool
 */

export const TOOL_DEFINITIONS = {
  check_availability: {
    name: "check_availability",
    description: "Check table availability for a specific date, time, and party size. This is ALWAYS the first step for any booking request and must be called whenever the user provides or changes date, time, or party size information. It returns available table types that the user can choose from.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Reservation date in YYYY-MM-DD format (required)"
        },
        time: {
          type: "string", 
          description: "Reservation time in HH:MM format (required)"
        },
        partySize: {
          type: "integer",
          description: "Number of people for the reservation (required)",
          minimum: 1,
          maximum: 20
        }
      },
      required: ["date", "time", "partySize"]
    }
  },

  get_menu_items: {
    name: "get_menu_items", 
    description: "Find and retrieve menu items based on user queries and dietary requirements. Use this when users ask about food, dishes, menu, prices, or have dietary restrictions.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Semantic search query string for finding dishes (e.g., 'best main courses', 'vegetarian options', 'seafood dishes')"
        },
        is_gluten_free: {
          type: "boolean",
          description: "Filter for gluten-free dishes only",
          default: false
        },
        is_vegan: {
          type: "boolean", 
          description: "Filter for vegan dishes only",
          default: false
        },
        is_vegetarian: {
          type: "boolean",
          description: "Filter for vegetarian dishes only", 
          default: false
        },
        category: {
          type: "string",
          description: "Filter by menu category (e.g., 'Main', 'Appetizer', 'Dessert', 'Drink')",
          enum: ["Main", "Appetizer", "Dessert", "Drink"]
        }
      },
      required: ["query"]
    }
  },

  get_restaurant_info: {
    name: "get_restaurant_info",
    description: "Retrieve factual information about the restaurant including hours, address, description, and general details. Use this for general restaurant inquiries.",
    parameters: {
      type: "object", 
      properties: {
        topic: {
          type: "string",
          description: "Specific information topic to retrieve",
          enum: ["hours", "address", "description", "general"],
          default: "general"
        }
      },
      required: ["topic"]
    }
  },

  create_reservation: {
    name: "create_reservation",
    description: "Create a final reservation after all details have been collected and availability has been confirmed. This is the FINAL step that actually books the table. Only call this when you have ALL required information: name, email, phone, date, time, partySize, and tableType.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Customer's full name (required)"
        },
        email: {
          type: "string",
          description: "Customer's email address (required)",
          format: "email"
        },
        phone: {
          type: "string", 
          description: "Customer's phone number (required)"
        },
        date: {
          type: "string",
          description: "Reservation date in YYYY-MM-DD format (required)"
        },
        time: {
          type: "string",
          description: "Reservation time in HH:MM format (required)"
        },
        partySize: {
          type: "integer",
          description: "Number of people for the reservation (required)",
          minimum: 1,
          maximum: 20
        },
        tableType: {
          type: "string",
          description: "Selected table type (required, must be from available options)"
        },
        specialRequests: {
          type: "string",
          description: "Any special requests or notes",
          default: null
        }
      },
      required: ["name", "email", "phone", "date", "time", "partySize", "tableType"]
    }
  },

  get_celebration_packages: {
    name: "get_celebration_packages",
    description: "Retrieve celebration packages and special occasion services available at the restaurant. Use this when users ask about celebrations, special occasions, birthday packages, anniversary setups, or romantic celebrations.",
    parameters: {
      type: "object",
      properties: {
        occasion_tags: {
          type: "array",
          items: {
            type: "string",
            enum: ["birthday", "anniversary", "romantic", "proposal", "celebration", "special_occasion"]
          },
          description: "Tags for the type of celebration or special occasion",
          default: []
        },
        budget_range: {
          type: "string",
          description: "Budget range for the celebration package",
          enum: ["budget", "standard", "premium", "luxury"],
          default: "standard"
        }
      },
      required: []
    }
  },

  clarify_and_respond: {
    name: "clarify_and_respond",
    description: "Use this tool ONLY when the user's request is ambiguous, out of scope, or you do not have enough information to call another tool. It is used to ask a clarifying question, provide general information, or politely handle requests that cannot be fulfilled by other tools.",
    parameters: {
      type: "object",
      properties: {
        response_type: {
          type: "string", 
          description: "Type of clarifying response needed",
          enum: ["clarification", "out_of_scope", "general_info", "greeting"],
          default: "clarification"
        },
        message: {
          type: "string",
          description: "The clarifying question or response message to send to the user"
        }
      },
      required: ["message"]
    }
  }
};

/**
 * Validates tool parameters against the tool definition
 * @param {string} toolName - Name of the tool
 * @param {object} parameters - Parameters to validate
 * @returns {object} - Validation result with success flag and errors
 */
export function validateToolParameters(toolName, parameters) {
  const toolDef = TOOL_DEFINITIONS[toolName];
  
  if (!toolDef) {
    return {
      success: false,
      errors: [`Unknown tool: ${toolName}`]
    };
  }

  const errors = [];
  const required = toolDef.parameters.required || [];
  
  // Check required parameters
  for (const param of required) {
    if (!(param in parameters)) {
      errors.push(`Missing required parameter: ${param}`);
    }
  }
  
  // Validate parameter types and constraints
  const properties = toolDef.parameters.properties || {};
  for (const [param, value] of Object.entries(parameters)) {
    const propDef = properties[param];
    if (!propDef) {
      errors.push(`Unknown parameter: ${param}`);
      continue;
    }
    
    // Type validation
    if (propDef.type === 'string' && typeof value !== 'string') {
      errors.push(`Parameter ${param} must be a string`);
    } else if (propDef.type === 'integer' && !Number.isInteger(value)) {
      errors.push(`Parameter ${param} must be an integer`);
    } else if (propDef.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Parameter ${param} must be a boolean`);
    }
    
    // Enum validation
    if (propDef.enum && !propDef.enum.includes(value)) {
      errors.push(`Parameter ${param} must be one of: ${propDef.enum.join(', ')}`);
    }
    
    // Range validation for integers
    if (propDef.type === 'integer') {
      if (propDef.minimum !== undefined && value < propDef.minimum) {
        errors.push(`Parameter ${param} must be at least ${propDef.minimum}`);
      }
      if (propDef.maximum !== undefined && value > propDef.maximum) {
        errors.push(`Parameter ${param} must be at most ${propDef.maximum}`);
      }
    }
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Get all available tool names
 * @returns {string[]} - Array of tool names
 */
export function getAvailableTools() {
  return Object.keys(TOOL_DEFINITIONS);
}

/**
 * Get tool definition by name
 * @param {string} toolName - Name of the tool
 * @returns {object|null} - Tool definition or null if not found
 */
export function getToolDefinition(toolName) {
  return TOOL_DEFINITIONS[toolName] || null;
}

export default {
  TOOL_DEFINITIONS,
  validateToolParameters,
  getAvailableTools,
  getToolDefinition
};