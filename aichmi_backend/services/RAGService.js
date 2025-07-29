/**
 * RAG (Retrieval-Augmented Generation) Service
 * Provides intelligent data retrieval for multi-agent system
 */

import RestaurantService from './RestaurantService.js';
import db from '../config/database.js';
import EmbeddingService from './EmbeddingService.js';

class RAGService {
    constructor() {
        // Keywords organized by domain for better retrieval
        this.domainKeywords = {
            restaurant: [
                'restaurant', 'about', 'info', 'information', 'hours', 'open', 'close', 'closing', 'opening',
                'location', 'address', 'where', 'atmosphere', 'ambiance', 'style', 'rating', 'review',
                'description', 'tell me about', 'what is', 'owner', 'contact', 'phone', 'email'
            ],
            menu: [
                'menu', 'food', 'dish', 'dishes', 'eat', 'meal', 'price', 'cost', 'order', 'cuisine',
                'vegetarian', 'vegan', 'gluten', 'diet', 'dietary', 'appetizer', 'main', 'dessert',
                'seafood', 'speciality', 'recommendation', 'what do you serve', 'what food',
                'budget', 'euros', 'expensive', 'cheap', 'affordable'
            ],
            reservation: [
                'book', 'booking', 'reserve', 'reservation', 'table', 'available', 'availability',
                'date', 'time', 'party', 'people', 'guests', 'confirm', 'seat', 'seating',
                'fully booked', 'busy', 'free', 'slot', 'biggest', 'largest', 'maximum', 'capacity',
                'accommodate', 'size', 'how many', 'big table', 'large table'
            ],
            celebration: [
                'birthday', 'anniversary', 'celebration', 'special', 'occasion', 'romantic',
                'cake', 'flower', 'flowers', 'surprise', 'proposal', 'wedding', 'engagement',
                'graduation', 'business', 'family', 'reunion'
            ],
            location: [
                'location', 'address', 'directions', 'how to get', 'where', 'transfer', 'transport',
                'pickup', 'airport', 'hotel', 'taxi', 'bus', 'car', 'transportation'
            ],
            support: [
                'help', 'support', 'contact', 'owner', 'manager', 'phone', 'email', 'problem',
                'issue', 'complaint', 'question', 'assistance', 'trouble'
            ]
        };
    }

    /**
     * Main RAG retrieval function
     * Analyzes query and retrieves relevant data for any agent
     */
    async retrieveRelevantData(query, restaurantId, agentType = null) {
        try {
            console.log(`🔍 RAG retrieving data for: "${query}" (Agent: ${agentType})`);
            
            const relevantData = {
                restaurant: null,
                owner: null,
                hours: [],
                menu: [],
                reservations: [],
                tables: [],
                fullyBookedDates: [],
                retrievalContext: {
                    query,
                    agentType,
                    keywords: this.extractKeywords(query),
                    confidence: 0
                }
            };

            // Always get basic restaurant info
            relevantData.restaurant = await RestaurantService.getRestaurantById(restaurantId);
            
            if (!relevantData.restaurant) {
                throw new Error(`Restaurant not found: ${restaurantId}`);
            }

            // Keyword-based retrieval
            const keywords = this.extractKeywords(query);
            const domains = this.identifyDomains(keywords);
            
            console.log(`🎯 Identified domains: ${domains.join(', ')}`);
            
            // Retrieve data based on identified domains
            await this.retrieveByDomains(domains, restaurantId, relevantData);
            
            // Calculate retrieval confidence
            relevantData.retrievalContext.confidence = this.calculateConfidence(keywords, domains);
            
            console.log(`✅ RAG retrieval complete (confidence: ${relevantData.retrievalContext.confidence})`);
            
            return relevantData;
            
        } catch (error) {
            console.error('❌ RAG retrieval error:', error);
            throw error;
        }
    }

    /**
     * Extract keywords from user query
     */
    extractKeywords(query) {
        const words = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
            
        return [...new Set(words)]; // Remove duplicates
    }

    /**
     * Identify relevant domains based on keywords
     */
    identifyDomains(keywords) {
        const domainScores = {};
        
        // Score each domain based on keyword matches
        for (const [domain, domainKeywords] of Object.entries(this.domainKeywords)) {
            let score = 0;
            for (const keyword of keywords) {
                for (const domainKeyword of domainKeywords) {
                    if (keyword.includes(domainKeyword) || domainKeyword.includes(keyword)) {
                        score += 1;
                        // Exact matches get higher score
                        if (keyword === domainKeyword) {
                            score += 1;
                        }
                    }
                }
            }
            domainScores[domain] = score;
        }
        
        // Return domains with scores above threshold, sorted by score
        return Object.entries(domainScores)
            .filter(([domain, score]) => score > 0)
            .sort(([,a], [,b]) => b - a)
            .map(([domain]) => domain);
    }

    /**
     * Retrieve data for identified domains
     */
    async retrieveByDomains(domains, restaurantId, relevantData) {
        const retrievalPromises = [];

        for (const domain of domains) {
            switch (domain) {
                case 'restaurant':
                    retrievalPromises.push(this.retrieveRestaurantData(restaurantId, relevantData));
                    break;
                case 'menu':
                    retrievalPromises.push(this.retrieveMenuData(restaurantId, relevantData));
                    break;
                case 'reservation':
                    retrievalPromises.push(this.retrieveReservationData(restaurantId, relevantData));
                    break;
                case 'celebration':
                    retrievalPromises.push(this.retrieveCelebrationData(restaurantId, relevantData));
                    break;
                case 'location':
                    retrievalPromises.push(this.retrieveLocationData(restaurantId, relevantData));
                    break;
                case 'support':
                    retrievalPromises.push(this.retrieveSupportData(restaurantId, relevantData));
                    break;
            }
        }

        // Execute all retrievals in parallel
        await Promise.allSettled(retrievalPromises);
    }

    /**
     * Retrieve restaurant-specific data
     */
    async retrieveRestaurantData(restaurantId, relevantData) {
        try {
            relevantData.owner = await RestaurantService.getRestaurantOwner(restaurantId);
            relevantData.hours = await RestaurantService.getRestaurantHours(restaurantId);
        } catch (error) {
            console.error('Error retrieving restaurant data:', error);
        }
    }

    /**
     * Retrieve menu data
     */
    async retrieveMenuData(restaurantId, relevantData) {
        try {
            relevantData.menu = await RestaurantService.getMenuItems(restaurantId);
        } catch (error) {
            console.error('Error retrieving menu data:', error);
        }
    }

    /**
     * Retrieve reservation data
     */
    async retrieveReservationData(restaurantId, relevantData) {
        try {
            relevantData.fullyBookedDates = await RestaurantService.getFullyBookedDates(restaurantId);
            relevantData.tables = await RestaurantService.getTableInventory(restaurantId);
            
            // Get recent reservations for context
            const recentReservationsQuery = `
                SELECT 
                    reservation_date,
                    guests,
                    table_type,
                    COUNT(*) as count
                FROM reservation 
                WHERE restaurant_id = $1 
                    AND reservation_date >= CURRENT_DATE 
                    AND reservation_date <= CURRENT_DATE + INTERVAL '30 days'
                GROUP BY reservation_date, guests, table_type
                ORDER BY reservation_date, table_type;
            `;
            
            relevantData.reservations = await db.query(recentReservationsQuery, [restaurantId]);
        } catch (error) {
            console.error('Error retrieving reservation data:', error);
        }
    }

    /**
     * Vector-based semantic search on table descriptions for ambiance/style queries
     */
    async semanticTableSearch(query, restaurantId) {
        try {
            console.log(`🔍 Vector semantic table search for: "${query}"`);
            
            // Skip embedding search and use fallback directly for regular querying
            console.log('❌ No tables with embeddings found');
            return await this.fallbackTableSearch(query, restaurantId);
                
        } catch (error) {
            console.error('❌ Error in vector semantic table search:', error);
            // Always fallback on error
            return await this.fallbackTableSearch(query, restaurantId);
        }
    }

    /**
     * Fallback table search when embeddings are not available
     */
    async fallbackTableSearch(query, restaurantId) {
        try {
            console.log('🔄 Using fallback table search');
            
            const tablesQuery = `
                SELECT 
                    table_id,
                    table_type,
                    table_price,
                    capacity,
                    description
                FROM tables 
                WHERE restaurant_id = $1;
            `;
            
            const tablesResult = await db.query(tablesQuery, [restaurantId]);
            
            if (!tablesResult || tablesResult.length === 0) {
                return [];
            }
            
            // Simple text matching as fallback
            const queryLower = query.toLowerCase();
            
            // Check if query is asking for biggest/largest table
            const isCapacityQuery = queryLower.includes('biggest') || queryLower.includes('largest') || 
                                   queryLower.includes('maximum') || queryLower.includes('big table') ||
                                   queryLower.includes('large table') || queryLower.includes('capacity');
            
            const matchingTables = tablesResult
                .map(table => {
                    const searchableText = `${table.table_type || ''}`.toLowerCase();
                    let relevanceScore = searchableText.includes(queryLower) ? 0.5 : 0.1;
                    
                    // Boost relevance for capacity queries
                    if (isCapacityQuery) {
                        relevanceScore = 0.8; // All tables are relevant for capacity queries
                    }
                    
                    return {
                        ...table,
                        relevanceScore,
                        searchableText: `${table.table_type || ''}`.trim()
                    };
                })
                .filter(table => table.relevanceScore > 0)
                .sort((a, b) => {
                    // For capacity queries, sort by capacity first, then relevance
                    if (isCapacityQuery) {
                        return b.capacity - a.capacity;
                    }
                    return b.relevanceScore - a.relevanceScore;
                });
            
            console.log(`✅ Fallback found ${matchingTables.length} tables`);
            return matchingTables;
            
        } catch (error) {
            console.error('❌ Error in fallback table search:', error);
            return [];
        }
    }

    /**
     * Vector-based hybrid search on menu items (embeddings + filtering)
     */
    async hybridMenuSearch(query, restaurantId, filters = {}) {
        try {
            console.log(`🔍 Vector hybrid menu search for: "${query}" with filters:`, filters);
            
            // Generate embedding for the query
            const queryEmbedding = await EmbeddingService.generateEmbedding(query);
            console.log(`🧠 Generated query embedding with ${queryEmbedding.length} dimensions`);
            
            // Build base query with vector similarity
            let menuQuery = `
                SELECT 
                    menu_item_id,
                    name,
                    description,
                    price,
                    category,
                    is_vegetarian,
                    is_vegan,
                    is_gluten_free,
                    embedding,
                    (embedding <=> $1::vector) as distance
                FROM menu_item 
                WHERE restaurant_id = $2 
                    AND embedding IS NOT NULL
            `;
            
            const queryParams = [EmbeddingService.embeddingToVector(queryEmbedding), restaurantId];
            let paramCount = 2;
            
            // Apply filters
            if (filters.is_vegetarian === true) {
                menuQuery += ` AND is_vegetarian = $${++paramCount}`;
                queryParams.push(true);
            }
            
            if (filters.is_vegan === true) {
                menuQuery += ` AND is_vegan = $${++paramCount}`;
                queryParams.push(true);
            }
            
            if (filters.is_gluten_free === true) {
                menuQuery += ` AND is_gluten_free = $${++paramCount}`;
                queryParams.push(true);
            }
            
            if (filters.category) {
                menuQuery += ` AND LOWER(category) = LOWER($${++paramCount})`;
                queryParams.push(filters.category);
            }
            
            if (filters.maxPrice) {
                menuQuery += ` AND price <= $${++paramCount}`;
                queryParams.push(filters.maxPrice);
            }
            
            // Order by similarity and limit results
            menuQuery += ` ORDER BY embedding <=> $1::vector LIMIT 20`;
            
            console.log(`📝 Executing vector menu query with ${queryParams.length} params`);
            const menuResult = await db.query(menuQuery, queryParams);
            
            if (!menuResult || menuResult.length === 0) {
                console.log('❌ No menu items with embeddings found matching filters');
                // Fallback to search without embeddings
                return await this.fallbackMenuSearch(query, restaurantId, filters);
            }
            
            console.log(`📊 Found ${menuResult.length} menu items after vector filtering`);
            
            // Convert distance to similarity score
            const scoredItems = menuResult.map(item => {
                const similarity = 1 - item.distance; // Convert distance to similarity
                const relevanceScore = Math.max(0, similarity); // Ensure non-negative
                
                console.log(`📊 Menu item "${item.name}" similarity: ${similarity.toFixed(4)} (distance: ${item.distance.toFixed(4)})`);
                
                return { 
                    ...item, 
                    relevanceScore: relevanceScore,
                    searchableText: `${item.name} ${item.description || ''} ${item.category || ''}`.trim()
                };
            });
            
            // Filter by minimum similarity threshold
            const filteredItems = scoredItems.filter(item => item.relevanceScore > 0.2); // Lower threshold for menu items
                
            console.log(`✅ Returning ${filteredItems.length} menu items after vector similarity scoring`);
            return filteredItems;
                
        } catch (error) {
            console.error('❌ Error in vector hybrid menu search:', error);
            // Fallback to search without embeddings
            return await this.fallbackMenuSearch(query, restaurantId, filters);
        }
    }

    /**
     * Fallback menu search when embeddings are not available
     */
    async fallbackMenuSearch(query, restaurantId, filters = {}) {
        try {
            console.log('🔄 Using fallback menu search');
            
            // Build base query without embeddings
            let menuQuery = `
                SELECT 
                    menu_item_id,
                    name,
                    description,
                    price,
                    category,
                    is_vegetarian,
                    is_vegan,
                    is_gluten_free,
                FROM menu_item 
                WHERE restaurant_id = $1 
            `;
            
            const queryParams = [restaurantId];
            let paramCount = 1;
            
            // Apply filters
            if (filters.is_vegetarian === true) {
                menuQuery += ` AND is_vegetarian = $${++paramCount}`;
                queryParams.push(true);
            }
            
            if (filters.is_vegan === true) {
                menuQuery += ` AND is_vegan = $${++paramCount}`;
                queryParams.push(true);
            }
            
            if (filters.is_gluten_free === true) {
                menuQuery += ` AND is_gluten_free = $${++paramCount}`;
                queryParams.push(true);
            }
            
            if (filters.category) {
                menuQuery += ` AND LOWER(category) = LOWER($${++paramCount})`;
                queryParams.push(filters.category);
            }
            
            if (filters.maxPrice) {
                menuQuery += ` AND price <= $${++paramCount}`;
                queryParams.push(filters.maxPrice);
            }
            
            const menuResult = await db.query(menuQuery, queryParams);
            
            if (!menuResult || menuResult.length === 0) {
                return [];
            }
            
            // Simple text matching as fallback
            const queryLower = query.toLowerCase();
            const matchingItems = menuResult
                .map(item => {
                    const searchableText = `${item.name} ${item.description || ''} ${item.category || ''}`.toLowerCase();
                    let relevanceScore = 0.1; // Base score
                    
                    if (searchableText.includes(queryLower)) {
                        relevanceScore = 0.6;
                    } else if (item.name.toLowerCase().includes(queryLower)) {
                        relevanceScore = 0.5;
                    } else if (item.category && item.category.toLowerCase().includes(queryLower)) {
                        relevanceScore = 0.3;
                    }
                    
                    return {
                        ...item,
                        relevanceScore,
                        searchableText: `${item.name} ${item.description || ''} ${item.category || ''}`.trim()
                    };
                })
                .filter(item => item.relevanceScore > 0.2)
                .sort((a, b) => b.relevanceScore - a.relevanceScore);
            
            console.log(`✅ Fallback found ${matchingItems.length} menu items`);
            return matchingItems;
            
        } catch (error) {
            console.error('❌ Error in fallback menu search:', error);
            return [];
        }
    }

    /**
     * Extract search terms from query for semantic matching
     */
    extractSearchTerms(query) {
        const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'what', 'are', 'your', 'best', 'good', 'great'];
        
        return query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.includes(word))
            .filter(word => word); // Remove empty strings
    }

    /**
     * Calculate semantic relevance score
     */
    calculateSemanticScore(searchTerms, text) {
        if (!searchTerms.length || !text) return 0;
        
        const lowerText = text.toLowerCase();
        let score = 0;
        
        // Semantic keyword mappings for better matching
        const semanticMappings = {
            'quiet': ['quiet', 'peaceful', 'intimate', 'private', 'cozy', 'serene'],
            'romantic': ['romantic', 'intimate', 'candlelit', 'couple', 'private', 'cozy'],
            'main': ['main', 'entree', 'course', 'dish', 'meal'],
            'best': ['special', 'signature', 'recommended', 'popular', 'favorite', 'chef'],
            'gluten': ['gluten', 'celiac', 'wheat'],
            'vegetarian': ['vegetarian', 'veggie', 'plant'],
            'vegan': ['vegan', 'plant-based'],
        };
        
        for (const term of searchTerms) {
            // Direct match
            if (lowerText.includes(term)) {
                score += 2;
            }
            
            // Semantic matches
            const semanticWords = semanticMappings[term] || [];
            for (const semantic of semanticWords) {
                if (lowerText.includes(semantic)) {
                    score += 1.5;
                }
            }
            
            // Partial matches
            const words = lowerText.split(/\s+/);
            for (const word of words) {
                if (word.includes(term) || term.includes(word)) {
                    score += 0.5;
                }
            }
        }
        
        return score;
    }

    /**
     * Retrieve celebration data
     */
    async retrieveCelebrationData(restaurantId, relevantData) {
        try {
            // For now, celebration data is static, but could be from database
            relevantData.celebrations = {
                available: true,
                services: ['cake', 'flowers'],
                pricing: {
                    cake: { price: 25, description: 'Beautiful celebration cake with personalized message' },
                    flowers: { price: 15, description: 'Fresh flower arrangement for your table' }
                }
            };
        } catch (error) {
            console.error('Error retrieving celebration data:', error);
        }
    }

    /**
     * Retrieve location and transfer data
     */
    async retrieveLocationData(restaurantId, relevantData) {
        try {
            // Check if transfer pricing exists
            const transferQuery = `
                SELECT 
                    transfer_id,
                    price_4_or_less,
                    price_5_to_8,
                    hotel_id,
                    restaurant_id
                FROM transfer_prices 
                WHERE restaurant_id = $1;
            `;
            
            relevantData.transfers = await db.query(transferQuery, [restaurantId]);
        } catch (error) {
            console.error('Error retrieving location data:', error);
            relevantData.transfers = []; // Default empty array
        }
    }

    /**
     * Retrieve support and contact data
     */
    async retrieveSupportData(restaurantId, relevantData) {
        try {
            // Support data is already in restaurant and owner info
            // Could add support tickets, FAQ, etc. here in future
            relevantData.supportInfo = {
                available: true,
                channels: ['phone', 'email', 'in-person'],
                hours: relevantData.hours || []
            };
        } catch (error) {
            console.error('Error retrieving support data:', error);
        }
    }

    /**
     * Calculate confidence score for retrieval
     */
    calculateConfidence(keywords, domains) {
        if (domains.length === 0) return 0.1; // Low confidence for no domain matches
        
        const keywordScore = Math.min(keywords.length / 5, 1); // Normalize to 0-1
        const domainScore = Math.min(domains.length / 3, 1); // Normalize to 0-1
        
        return Math.round((keywordScore * 0.4 + domainScore * 0.6) * 100) / 100;
    }

    /**
     * Generate context summary for agents
     */
    generateContextSummary(relevantData) {
        const summary = [];
        
        if (relevantData.restaurant) {
            summary.push(`Restaurant: ${relevantData.restaurant.name} in ${relevantData.restaurant.island}`);
        }
        
        if (relevantData.menu && relevantData.menu.length > 0) {
            summary.push(`Menu items: ${relevantData.menu.length} dishes available`);
        }
        
        if (relevantData.hours && relevantData.hours.length > 0) {
            summary.push(`Operating hours: ${relevantData.hours.length} days defined`);
        }
        
        if (relevantData.fullyBookedDates && relevantData.fullyBookedDates.length > 0) {
            summary.push(`Unavailable dates: ${relevantData.fullyBookedDates.length} dates fully booked`);
        }
        
        return summary.join(' | ');
    }

    /**
     * General vector similarity search across all entities
     */
    async vectorSearch(query, restaurantId, entityTypes = ['tables', 'menu_items', 'restaurant'], topK = 5) {
        try {
            console.log(`🔍 Vector search for: "${query}" in types: ${entityTypes.join(', ')}`);
            
            // Generate embedding for the query
            const queryEmbedding = await EmbeddingService.generateEmbedding(query);
            const queryVector = EmbeddingService.embeddingToVector(queryEmbedding);
            
            const results = [];
            
            // Search tables if requested
            if (entityTypes.includes('tables')) {
                const tableResults = await this.vectorSearchTables(queryVector, restaurantId, topK);
                results.push(...tableResults.map(r => ({ ...r, entityType: 'table' })));
            }
            
            // Search menu items if requested
            if (entityTypes.includes('menu_items')) {
                const menuResults = await this.vectorSearchMenuItems(queryVector, restaurantId, topK);
                results.push(...menuResults.map(r => ({ ...r, entityType: 'menu_item' })));
            }
            
            // Search restaurant if requested
            if (entityTypes.includes('restaurant')) {
                const restaurantResults = await this.vectorSearchRestaurant(queryVector, restaurantId, topK);
                results.push(...restaurantResults.map(r => ({ ...r, entityType: 'restaurant' })));
            }
            
            // Sort by relevance and limit to topK
            const sortedResults = results
                .sort((a, b) => b.relevanceScore - a.relevanceScore)
                .slice(0, topK);
            
            console.log(`✅ Vector search found ${sortedResults.length} results`);
            return sortedResults;
            
        } catch (error) {
            console.error('❌ Error in vector search:', error);
            return [];
        }
    }

    /**
     * Vector search specifically for tables
     */
    async vectorSearchTables(queryVector, restaurantId, limit = 5) {
        try {
            const query = `
                SELECT 
                    table_id,
                    table_type,
                    table_price,
                    description,
                    (embedding <=> $1::vector) as distance
                FROM tables 
                WHERE restaurant_id = $2 
                    AND embedding IS NOT NULL
                ORDER BY embedding <=> $1::vector
                LIMIT $3;
            `;
            
            const result = await db.query(query, [queryVector, restaurantId, limit]);
            
            return result.map(row => ({
                ...row,
                relevanceScore: Math.max(0, 1 - row.distance)
            }));
            
        } catch (error) {
            console.error('❌ Error in vector table search:', error);
            return [];
        }
    }

    /**
     * Vector search specifically for menu items
     */
    async vectorSearchMenuItems(queryVector, restaurantId, limit = 5) {
        try {
            const query = `
                SELECT 
                    menu_item_id,
                    name,
                    description,
                    price,
                    category,
                    is_vegetarian,
                    is_vegan,
                    is_gluten_free,
                    (embedding <=> $1::vector) as distance
                FROM menu_item 
                WHERE restaurant_id = $2 
                    AND embedding IS NOT NULL
                ORDER BY embedding <=> $1::vector
                LIMIT $3;
            `;
            
            const result = await db.query(query, [queryVector, restaurantId, limit]);
            
            return result.map(row => ({
                ...row,
                relevanceScore: Math.max(0, 1 - row.distance)
            }));
            
        } catch (error) {
            console.error('❌ Error in vector menu search:', error);
            return [];
        }
    }

    /**
     * Vector search specifically for restaurant
     */
    async vectorSearchRestaurant(queryVector, restaurantId, limit = 1) {
        try {
            const query = `
                SELECT 
                    restaurant_id,
                    name,
                    description,
                    cuisine,
                    area,
                    island,
                    (embedding <=> $1::vector) as distance
                FROM restaurant 
                WHERE restaurant_id = $2 
                    AND embedding IS NOT NULL
                ORDER BY embedding <=> $1::vector
                LIMIT $3;
            `;
            
            const result = await db.query(query, [queryVector, restaurantId, limit]);
            
            return result.map(row => ({
                ...row,
                relevanceScore: Math.max(0, 1 - row.distance)
            }));
            
        } catch (error) {
            console.error('❌ Error in vector restaurant search:', error);
            return [];
        }
    }

    /**
     * Generic hybrid search function that combines vector similarity with SQL filters
     * @param {string} queryText - The search query text
     * @param {string} tableName - Target table name (menu_item, tables, restaurant)
     * @param {Object} filters - SQL WHERE clause filters (e.g., { restaurant_id: 1, is_vegan: true })
     * @param {number} topK - Maximum number of results to return
     * @returns {Promise<Array>} - Array of search results with relevance scores
     */
    async hybridSearch(queryText, tableName, filters = {}, topK = 5) {
        try {
            console.log(`🔍 Hybrid search on ${tableName} for: "${queryText}" with filters:`, filters);
            
            // Generate embedding for the query
            const queryEmbedding = await EmbeddingService.generateEmbedding(queryText);
            const queryVector = EmbeddingService.embeddingToVector(queryEmbedding);
            
            // Build base query for each supported table
            let baseQuery, selectFields;
            
            switch (tableName) {
                case 'menu_item':
                    selectFields = `
                        menu_item_id,
                        name,
                        description,
                        price,
                        category,
                        is_vegetarian,
                        is_vegan,
                        is_gluten_free,
                        restaurant_id
                    `;
                    break;
                case 'tables':
                    selectFields = `
                        table_id,
                        table_type,
                        table_price,
                        description,
                        restaurant_id
                    `;
                    break;
                case 'restaurant':
                    selectFields = `
                        restaurant_id,
                        name,
                        description,
                        cuisine,
                        area,
                        island,
                        address,
                        phone,
                        email
                    `;
                    break;
                default:
                    throw new Error(`Unsupported table: ${tableName}`);
            }
            
            // Build the SQL query with vector similarity and filters
            let query = `
                SELECT 
                    ${selectFields},
                    (embedding <=> $1::vector) as distance,
                    (1 - (embedding <=> $1::vector)) as similarity_score
                FROM ${tableName}
                WHERE embedding IS NOT NULL
            `;
            
            const queryParams = [queryVector];
            let paramCount = 1;
            
            // Add filters to WHERE clause
            for (const [column, value] of Object.entries(filters)) {
                if (value !== undefined && value !== null) {
                    paramCount++;
                    if (typeof value === 'boolean') {
                        query += ` AND ${column} = $${paramCount}`;
                        queryParams.push(value);
                    } else if (typeof value === 'string') {
                        query += ` AND LOWER(${column}) = LOWER($${paramCount})`;
                        queryParams.push(value);
                    } else {
                        query += ` AND ${column} = $${paramCount}`;
                        queryParams.push(value);
                    }
                }
            }
            
            // Order by similarity and limit results
            query += ` ORDER BY embedding <=> $1::vector LIMIT $${paramCount + 1}`;
            queryParams.push(topK);
            
            console.log(`📝 Executing hybrid search query with ${queryParams.length} parameters`);
            const result = await db.query(query, queryParams);
            
            if (!result || result.length === 0) {
                console.log(`❌ No results found in ${tableName} with given filters`);
                return [];
            }
            
            // Process results and add relevance scoring
            const processedResults = result.map(row => {
                const similarity = Math.max(0, row.similarity_score || 0);
                
                // Remove internal fields and add metadata
                const { distance, similarity_score, ...cleanRow } = row;
                
                return {
                    ...cleanRow,
                    relevanceScore: similarity,
                    distance: row.distance,
                    searchMetadata: {
                        query: queryText,
                        table: tableName,
                        filters: filters,
                        timestamp: new Date().toISOString()
                    }
                };
            });
            
            console.log(`✅ Hybrid search found ${processedResults.length} results in ${tableName}`);
            return processedResults;
            
        } catch (error) {
            console.error(`❌ Error in hybrid search on ${tableName}:`, error);
            throw error;
        }
    }

    /**
     * Generate and store embedding for a specific row in a table
     * @param {string} tableName - Target table name
     * @param {number} rowId - The ID of the row to update
     * @param {Object} rowData - The data to generate embedding from
     * @returns {Promise<boolean>} - Success status
     */
    async generateAndStoreEmbedding(tableName, rowId, rowData) {
        try {
            console.log(`🧠 Generating embedding for ${tableName} ID: ${rowId}`);
            
            let embedding;
            let idColumn;
            
            // Generate embedding based on table type
            switch (tableName) {
                case 'menu_item':
                    embedding = await EmbeddingService.generateMenuItemEmbedding(rowData);
                    idColumn = 'menu_item_id';
                    break;
                case 'tables':
                    embedding = await EmbeddingService.generateTableEmbedding(rowData);
                    idColumn = 'table_id';
                    break;
                case 'restaurant':
                    embedding = await EmbeddingService.generateRestaurantEmbedding(rowData);
                    idColumn = 'restaurant_id';
                    break;
                default:
                    throw new Error(`Unsupported table for embedding: ${tableName}`);
            }
            
            // Convert embedding to PostgreSQL vector format
            const embeddingVector = EmbeddingService.embeddingToVector(embedding);
            
            // Update the row with the new embedding
            const updateQuery = `UPDATE ${tableName} SET embedding = $1 WHERE ${idColumn} = $2`;
            await db.query(updateQuery, [embeddingVector, rowId]);
            
            console.log(`✅ Updated embedding for ${tableName} ID: ${rowId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Error generating/storing embedding for ${tableName} ID ${rowId}:`, error);
            throw error;
        }
    }

    /**
     * Batch update embeddings for multiple rows in a table
     * @param {string} tableName - Target table name
     * @param {Array} rows - Array of row objects to update
     * @returns {Promise<Object>} - Results summary
     */
    async batchUpdateEmbeddings(tableName, rows) {
        try {
            console.log(`🚀 Batch updating embeddings for ${rows.length} rows in ${tableName}`);
            
            const results = {
                success: 0,
                errors: 0,
                errorDetails: []
            };
            
            let idColumn;
            switch (tableName) {
                case 'menu_item':
                    idColumn = 'menu_item_id';
                    break;
                case 'tables':
                    idColumn = 'table_id';
                    break;
                case 'restaurant':
                    idColumn = 'restaurant_id';
                    break;
                default:
                    throw new Error(`Unsupported table for batch update: ${tableName}`);
            }
            
            // Process rows sequentially to avoid rate limits
            for (const row of rows) {
                try {
                    const rowId = row[idColumn];
                    await this.generateAndStoreEmbedding(tableName, rowId, row);
                    results.success++;
                    
                    // Small delay to respect API rate limits
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    results.errors++;
                    results.errorDetails.push({
                        rowId: row[idColumn],
                        error: error.message
                    });
                    console.error(`❌ Failed to update embedding for row ${row[idColumn]}:`, error);
                }
            }
            
            console.log(`✅ Batch update complete: ${results.success} success, ${results.errors} errors`);
            return results;
            
        } catch (error) {
            console.error(`❌ Error in batch embedding update for ${tableName}:`, error);
            throw error;
        }
    }

    /**
     * Generate embeddings for all existing data (one-time setup)
     */
    async generateAllEmbeddings(restaurantId = null) {
        try {
            console.log('🚀 Starting embedding generation for menu items only...');
            
            const results = {
                menuItems: 0,
                errors: []
            };
            
            // Generate menu item embeddings only
            try {
                const menuCount = await this.generateMenuItemEmbeddings(restaurantId);
                results.menuItems = menuCount;
            } catch (error) {
                results.errors.push(`Menu item embeddings: ${error.message}`);
            }
            
            console.log('✅ Embedding generation completed:', results);
            return results;
            
        } catch (error) {
            console.error('❌ Error generating embeddings:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings for restaurants
     */
    async generateRestaurantEmbeddings(restaurantId = null) {
        const whereClause = restaurantId ? 'WHERE restaurant_id = $1' : '';
        const params = restaurantId ? [restaurantId] : [];
        
        const selectQuery = `
            SELECT restaurant_id, name, description, cuisine, area, island
            FROM restaurant ${whereClause}
        `;
        
        const result = await db.query(selectQuery, params);
        
        for (const restaurant of result) {
            try {
                const embedding = await EmbeddingService.generateRestaurantEmbedding(restaurant);
                const embeddingVector = EmbeddingService.embeddingToVector(embedding);
                
                await db.query(
                    'UPDATE restaurant SET embedding = $1 WHERE restaurant_id = $2',
                    [embeddingVector, restaurant.restaurant_id]
                );
                
                console.log(`✅ Generated embedding for restaurant: ${restaurant.name}`);
                
            } catch (error) {
                console.error(`❌ Error generating embedding for restaurant ${restaurant.name}:`, error);
            }
        }
        
        return result.length;
    }

    /**
     * Generate embeddings for tables
     */
    async generateTableEmbeddings(restaurantId = null) {
        const whereClause = restaurantId ? 'WHERE restaurant_id = $1' : '';
        const params = restaurantId ? [restaurantId] : [];
        
        const selectQuery = `
            SELECT table_id, table_type, restaurant_id
            FROM tables ${whereClause}
        `;
        
        const result = await db.query(selectQuery, params);
        
        for (const table of result) {
            try {
                const embedding = await EmbeddingService.generateTableEmbedding(table);
                const embeddingVector = EmbeddingService.embeddingToVector(embedding);
                
                await db.query(
                    'UPDATE tables SET embedding = $1 WHERE table_id = $2',
                    [embeddingVector, table.table_id]
                );
                
                console.log(`✅ Generated embedding for table: ${table.table_type} (ID: ${table.table_id})`);
                
            } catch (error) {
                console.error(`❌ Error generating embedding for table ${table.table_id}:`, error);
            }
        }
        
        return result.length;
    }

    /**
     * Generate embeddings for menu items
     */
    async generateMenuItemEmbeddings(restaurantId = null) {
        const whereClause = restaurantId ? 'WHERE restaurant_id = $1' : '';
        const params = restaurantId ? [restaurantId] : [];
        
        const selectQuery = `
            SELECT menu_item_id, name, description, category, 
                   is_vegetarian, is_vegan, is_gluten_free, restaurant_id
            FROM menu_item ${whereClause}
        `;
        
        const result = await db.query(selectQuery, params);
        
        for (const menuItem of result) {
            try {
                const embedding = await EmbeddingService.generateMenuItemEmbedding(menuItem);
                const embeddingVector = EmbeddingService.embeddingToVector(embedding);
                
                await db.query(
                    'UPDATE menu_item SET embedding = $1 WHERE menu_item_id = $2',
                    [embeddingVector, menuItem.menu_item_id]
                );
                
                console.log(`✅ Generated embedding for menu item: ${menuItem.name}`);
                
            } catch (error) {
                console.error(`❌ Error generating embedding for menu item ${menuItem.name}:`, error);
            }
        }
        
        return result.length;
    }
}

// Export singleton instance
export default new RAGService();