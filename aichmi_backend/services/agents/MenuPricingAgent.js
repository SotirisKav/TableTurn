/**
 * Menu & Pricing Agent
 * Specializes in menu information, dish details, pricing, and dietary options
 */

import BaseAgent from './BaseAgent.js';
import RestaurantService from '../RestaurantService.js';
import RAGService from '../RAGService.js';

class MenuPricingAgent extends BaseAgent {
    constructor() {
        super(
            'MenuPricingAgent',
            'Menu & Pricing Specialist',
            ['menu', 'food', 'dish', 'price', 'cost', 'diet', 'cuisine']
        );
    }

    async processMessage(message, history, restaurantId, context) {
        try {
            console.log(`🍽️ ${this.name} processing:`, message);

            // Use RAG to retrieve relevant data
            const ragData = await this.retrieveRAGData(message, restaurantId);
            
            // Check if query requires hybrid menu search (dietary restrictions, specific dish types)
            const dietaryFilters = this.extractDietaryFilters(message);
            const requiresHybridSearch = Object.keys(dietaryFilters).length > 0 || 
                                       this.hasSpecificMenuQuery(message);
            
            // Perform hybrid menu search if needed using the new generic hybridSearch
            let hybridMenuResults = [];
            if (requiresHybridSearch) {
                console.log('🔍 Performing hybrid menu search with filters:', dietaryFilters);
                
                // Add restaurant_id to filters to ensure we only get results from this restaurant
                const searchFilters = { 
                    restaurant_id: restaurantId, 
                    available: true,
                    ...dietaryFilters 
                };
                
                // Use the new generic hybridSearch method
                hybridMenuResults = await RAGService.hybridSearch(
                    message, 
                    'menu_item', 
                    searchFilters, 
                    10  // Get top 10 results
                );
                
                if (hybridMenuResults.length > 0) {
                    console.log(`✅ Found ${hybridMenuResults.length} hybrid menu matches`);
                    hybridMenuResults.forEach(item => {
                        console.log(`   - ${item.name} (score: ${item.relevanceScore.toFixed(3)}, price: ${item.price}€)`);
                    });
                }
            }
            
            // Fetch menu and pricing data (still needed for system prompt)
            const menuData = await this.fetchMenuData(restaurantId);
            
            // Add hybrid search results to menu data
            if (hybridMenuResults.length > 0) {
                menuData.hybridResults = hybridMenuResults;
                menuData.hasHybridMatch = true;
                menuData.appliedFilters = dietaryFilters;
            }
            
            // Check if user is asking about reservations (suggest delegation to ReservationAgent)
            if (this.shouldDelegateToReservation(message)) {
                console.log('🔄 Delegating reservation query portion to ReservationAgent');
                return {
                    type: 'delegation',
                    delegateTo: 'ReservationAgent',
                    originalQuery: message,
                    context: {
                        ...context,
                        delegatedFromAgent: 'MenuPricingAgent',
                        menuContext: menuData
                    }
                };
            }
            
            // Build system prompt
            const systemPrompt = this.buildSystemPrompt(menuData);
            
            // Build conversation context
            const conversationHistory = this.buildConversationHistory(history);
            
            // Create full prompt
            const fullPrompt = this.buildPrompt(message, conversationHistory, menuData);
            
            // Generate response with RAG context
            const aiResponse = await this.generateResponse(fullPrompt, systemPrompt, ragData);
            
            // Check if user wants to make a reservation (suggest handoff)
            if (this.shouldHandoffToReservation(message)) {
                return {
                    ...this.formatResponse(aiResponse),
                    ...this.suggestHandoff('reservation', message, {
                        restaurant: menuData.restaurant,
                        userInterest: 'booking_after_menu'
                    }, restaurantId)
                };
            }
            
            return this.formatResponse(aiResponse);
            
        } catch (error) {
            console.error(`❌ ${this.name} error:`, error);
            return this.formatResponse(
                "I apologize, but I'm having trouble accessing menu information right now. Please try again in a moment.",
                'message',
                { error: true }
            );
        }
    }

    async fetchMenuData(restaurantId) {
        try {
            // Fetch restaurant info
            const restaurant = await RestaurantService.getRestaurantById(restaurantId);
            
            // Fetch menu items
            const menuItems = await RestaurantService.getMenuItems(restaurantId);
            
            // Fetch table pricing (relates to dining experience)
            const tableTypes = await RestaurantService.getTableTypes(restaurantId);
            
            // Organize menu by categories
            const organizedMenu = this.organizeMenuByCategory(menuItems);
            
            return {
                restaurant,
                menuItems: menuItems || [],
                organizedMenu,
                tableTypes: tableTypes || [],
                hasMenu: menuItems && menuItems.length > 0
            };
            
        } catch (error) {
            console.error('❌ Error fetching menu data:', error);
            throw error;
        }
    }

    organizeMenuByCategory(menuItems) {
        if (!menuItems || menuItems.length === 0) return {};
        
        const categories = {};
        
        menuItems.forEach(item => {
            const category = item.category || 'Main Dishes';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(item);
        });
        
        return categories;
    }

    buildSystemPrompt(menuData) {
        const { restaurant, menuItems, hybridResults, hasHybridMatch } = menuData;
        
        const vegetarianCount = menuItems?.filter(item => item.is_vegetarian).length || 0;
        const veganCount = menuItems?.filter(item => item.is_vegan).length || 0;
        const glutenFreeCount = menuItems?.filter(item => item.is_gluten_free).length || 0;
        
        // Group menu items by category
        const menuByCategory = menuItems?.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {}) || {};
        
        // Format menu items by category
        const formattedMenu = Object.entries(menuByCategory)
            .map(([category, items]) => {
                const categoryItems = items.map(item => 
                    `- ${item.name}: €${item.price} ${this.formatDietaryInfo(item)}`
                ).join('\n');
                return `${category.toUpperCase()}:\n${categoryItems}`;
            }).join('\n\n');
        
        return `You are AICHMI, a concise menu assistant for ${restaurant.name}.

${hasHybridMatch ? `RECOMMENDED DISHES:
${hybridResults.slice(0,5).map(item => 
    `- ${item.name}: €${item.price} ${this.formatDietaryInfo(item)}`
).join('\n')}

` : ''}COMPLETE MENU:
${formattedMenu}

DIETARY OPTIONS: ${vegetarianCount} vegetarian, ${veganCount} vegan, ${glutenFreeCount} gluten-free

GUIDELINES:
- Be brief and helpful about menu items
- Use: 🌱 Vegetarian, 🌿 Vegan, 🌾 Gluten-free
- Include prices when mentioning dishes
- Always show items from the COMPLETE MENU above, never make up items
- Focus on what the user asked for`;
    }

    formatDietaryInfo(item) {
        const dietary = [];
        if (item.is_vegetarian) dietary.push('🌱 Vegetarian');
        if (item.is_vegan) dietary.push('🌿 Vegan');
        if (item.is_gluten_free) dietary.push('🌾 Gluten-free');
        
        return dietary.length > 0 ? `(${dietary.join(', ')})` : '';
    }

    buildPrompt(message, conversationHistory, menuData) {
        let prompt = '';
        
        if (conversationHistory) {
            prompt += `Previous conversation:\n${conversationHistory}\n\n`;
        }
        
        prompt += `Current user message: ${message}

Please help the guest with menu information for ${menuData.restaurant.name}. Provide detailed information about dishes, prices, dietary options, and recommendations based on their interests or dietary needs.`;

        return prompt;
    }

    shouldHandoffToReservation(message) {
        const reservationKeywords = [
            'book', 'reserve', 'table', 'reservation', 'sounds good',
            'I want to', 'let\'s book', 'make a reservation', 'availability'
        ];
        
        const msg = message.toLowerCase();
        return reservationKeywords.some(keyword => msg.includes(keyword));
    }

    shouldDelegateToReservation(message) {
        const reservationKeywords = [
            'book', 'reserve', 'table', 'reservation', 'available', 'date', 'time',
            'party', 'people', 'guests', 'confirm', 'booking', 'friday', 'quiet', 'romantic'
        ];
        
        const msg = message.toLowerCase();
        return reservationKeywords.some(keyword => msg.includes(keyword));
    }

    extractDietaryFilters(message) {
        const msg = message.toLowerCase();
        const filters = {};
        
        // Check for dietary restrictions
        if (msg.includes('gluten') || msg.includes('celiac') || msg.includes('gluten-free')) {
            filters.is_gluten_free = true;
        }
        
        if (msg.includes('vegetarian') || msg.includes('veggie')) {
            filters.is_vegetarian = true;
        }
        
        if (msg.includes('vegan') || msg.includes('plant-based')) {
            filters.is_vegan = true;
        }
        
        // Check for category filters
        if (msg.includes('main') || msg.includes('entree') || msg.includes('main course')) {
            filters.category = 'Main';
        } else if (msg.includes('appetizer') || msg.includes('starter')) {
            filters.category = 'Appetizer';
        } else if (msg.includes('dessert')) {
            filters.category = 'Dessert';
        } else if (msg.includes('drink') || msg.includes('beverage')) {
            filters.category = 'Drink';
        }
        
        return filters;
    }

    hasSpecificMenuQuery(message) {
        const specificQueries = [
            'best', 'recommend', 'popular', 'signature', 'special', 'favorite',
            'main course', 'dish', 'food', 'cuisine', 'what do you serve'
        ];
        
        const msg = message.toLowerCase();
        return specificQueries.some(query => msg.includes(query));
    }
}

export default MenuPricingAgent;