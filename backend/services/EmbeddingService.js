/**
 * Embedding Service using Google Gemini 2.0
 * Generates vector embeddings for semantic search
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

class EmbeddingService {
    constructor() {
        // Initialize Gemini AI
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // Use text-embedding-004 model for embeddings
        this.embeddingModel = this.genAI.getGenerativeModel({ 
            model: "text-embedding-004" 
        });
        
        // Embedding dimensions for text-embedding-004
        this.embeddingDimensions = 768;
        
        console.log('🤖 EmbeddingService initialized with Gemini 2.0');
    }

    /**
     * Generate embeddings for a text
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} - Vector embedding
     */
    async generateEmbedding(text) {
        try {
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                throw new Error('Invalid text input for embedding generation');
            }

            console.log(`🔍 Generating embedding for: "${text.substring(0, 50)}..."`);
            
            // Generate embedding using Gemini
            const result = await this.embeddingModel.embedContent(text.trim());
            
            if (!result.embedding || !result.embedding.values) {
                throw new Error('Failed to generate embedding - no values returned');
            }

            const embedding = result.embedding.values;
            
            console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
            
            return embedding;
            
        } catch (error) {
            console.error('❌ Error generating embedding:', error);
            throw new Error(`Embedding generation failed: ${error.message}`);
        }
    }

    /**
     * Generate embeddings for multiple texts
     * @param {string[]} texts - Array of texts to embed
     * @returns {Promise<number[][]>} - Array of vector embeddings
     */
    async generateBatchEmbeddings(texts) {
        try {
            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('Invalid texts array for batch embedding generation');
            }

            console.log(`🔍 Generating embeddings for ${texts.length} texts`);
            
            // Process embeddings sequentially to avoid rate limits
            const embeddings = [];
            for (let i = 0; i < texts.length; i++) {
                const text = texts[i];
                console.log(`  Processing ${i + 1}/${texts.length}: ${text.substring(0, 30)}...`);
                
                const embedding = await this.generateEmbedding(text);
                embeddings.push(embedding);
                
                // Small delay to respect rate limits
                if (i < texts.length - 1) {
                    await this.delay(100);
                }
            }
            
            console.log(`✅ Generated ${embeddings.length} embeddings`);
            return embeddings;
            
        } catch (error) {
            console.error('❌ Error generating batch embeddings:', error);
            throw new Error(`Batch embedding generation failed: ${error.message}`);
        }
    }

    /**
     * Generate embedding for table description (table type + description)
     * @param {Object} table - Table object with table_type and description
     * @returns {Promise<number[]>} - Vector embedding
     */
    async generateTableEmbedding(table) {
        try {
            const { table_type } = table;
            
            // Use table type for embedding (since description column doesn't exist)
            const combinedText = `${table_type || ''}`.trim();
            
            if (!combinedText) {
                console.warn('⚠️ Empty table text, generating embedding for "standard table"');
                return await this.generateEmbedding('standard table seating');
            }
            
            // Enhance with context for better semantic understanding
            const contextualText = `Restaurant table: ${combinedText}. Seating arrangement and dining experience.`;
            
            return await this.generateEmbedding(contextualText);
            
        } catch (error) {
            console.error('❌ Error generating table embedding:', error);
            throw error;
        }
    }

    /**
     * Generate embedding for menu item (name + description + category)
     * @param {Object} menuItem - Menu item object
     * @returns {Promise<number[]>} - Vector embedding
     */
    async generateMenuItemEmbedding(menuItem) {
        try {
            const { name, description, category, is_vegetarian, is_vegan, is_gluten_free } = menuItem;
            
            // Build comprehensive text representation
            let combinedText = `${name || ''}`;
            
            if (description) {
                combinedText += ` - ${description}`;
            }
            
            if (category) {
                combinedText += ` (${category})`;
            }
            
            // Add dietary information
            const dietaryTags = [];
            if (is_vegetarian) dietaryTags.push('vegetarian');
            if (is_vegan) dietaryTags.push('vegan');
            if (is_gluten_free) dietaryTags.push('gluten-free');
            
            if (dietaryTags.length > 0) {
                combinedText += ` [${dietaryTags.join(', ')}]`;
            }
            
            if (!combinedText.trim()) {
                console.warn('⚠️ Empty menu item text, using fallback');
                return await this.generateEmbedding('restaurant menu item food dish');
            }
            
            // Enhance with context for better semantic understanding
            const contextualText = `Menu dish: ${combinedText.trim()}. Restaurant food item.`;
            
            return await this.generateEmbedding(contextualText);
            
        } catch (error) {
            console.error('❌ Error generating menu item embedding:', error);
            throw error;
        }
    }

    /**
     * Generate embedding for restaurant description
     * @param {Object} restaurant - Restaurant object
     * @returns {Promise<number[]>} - Vector embedding
     */
    async generateRestaurantEmbedding(restaurant) {
        try {
            const { name, description, cuisine, area, island } = restaurant;
            
            // Build comprehensive text representation
            let combinedText = `${name || ''}`;
            
            if (cuisine) {
                combinedText += ` - ${cuisine} cuisine`;
            }
            
            if (description) {
                combinedText += `. ${description}`;
            }
            
            if (area && island) {
                combinedText += ` Located in ${area}, ${island}.`;
            }
            
            if (!combinedText.trim()) {
                console.warn('⚠️ Empty restaurant text, using fallback');
                return await this.generateEmbedding('restaurant dining establishment');
            }
            
            // Enhance with context
            const contextualText = `Restaurant: ${combinedText.trim()}`;
            
            return await this.generateEmbedding(contextualText);
            
        } catch (error) {
            console.error('❌ Error generating restaurant embedding:', error);
            throw error;
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {number[]} vectorA - First vector
     * @param {number[]} vectorB - Second vector
     * @returns {number} - Cosine similarity score (0-1)
     */
    cosineSimilarity(vectorA, vectorB) {
        if (vectorA.length !== vectorB.length) {
            throw new Error('Vectors must have the same length for cosine similarity');
        }

        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            magnitudeA += vectorA[i] * vectorA[i];
            magnitudeB += vectorB[i] * vectorB[i];
        }

        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Convert embedding array to PostgreSQL vector format
     * @param {number[]} embedding - Embedding array
     * @returns {string} - PostgreSQL vector string
     */
    embeddingToVector(embedding) {
        if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error('Invalid embedding array');
        }
        
        return `[${embedding.join(',')}]`;
    }

    /**
     * Utility function for delays
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate embedding dimensions
     * @param {number[]} embedding - Embedding to validate
     * @returns {boolean} - True if valid
     */
    validateEmbedding(embedding) {
        return Array.isArray(embedding) && 
               embedding.length === this.embeddingDimensions &&
               embedding.every(val => typeof val === 'number' && !isNaN(val));
    }

    /**
     * Get embedding dimensions
     * @returns {number} - Number of dimensions
     */
    getEmbeddingDimensions() {
        return this.embeddingDimensions;
    }
}

// Export singleton instance
export default new EmbeddingService();