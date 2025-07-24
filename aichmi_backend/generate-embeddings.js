#!/usr/bin/env node
/**
 * Generate Embeddings for Sample Data
 * 
 * Run this script after populating your database with sample_data.sql
 * to generate embeddings for all restaurants, menu items, and tables.
 * 
 * Usage: node generate-embeddings.js
 */

import dotenv from 'dotenv';
import db from './config/database.js';
import RAGService from './services/RAGService.js';

dotenv.config();

console.log('🧠 Generating embeddings for existing data...\n');

async function generateEmbeddings() {
    try {
        // Check if GEMINI_API_KEY is set
        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY not found in environment variables');
            console.error('   Please set your Gemini API key in .env file:');
            console.error('   GEMINI_API_KEY=your_api_key_here');
            process.exit(1);
        }

        // Check database connection
        console.log('🔍 Checking database connection...');
        await db.query('SELECT 1');
        console.log('✅ Database connected\n');

        // Check if data exists
        console.log('📊 Checking existing data...');
        
        let restaurantCount = 0;
        let menuCount = 0;
        let tableCount = 0;

        try {
            const restaurantResult = await db.query('SELECT COUNT(*) FROM restaurant');
            const menuResult = await db.query('SELECT COUNT(*) FROM menu_item');
            const tableResult = await db.query('SELECT COUNT(*) FROM tables');

            // Handle different possible result structures
            restaurantCount = parseInt(restaurantResult.rows?.[0]?.count || restaurantResult[0]?.count || 0);
            menuCount = parseInt(menuResult.rows?.[0]?.count || menuResult[0]?.count || 0);
            tableCount = parseInt(tableResult.rows?.[0]?.count || tableResult[0]?.count || 0);
        } catch (error) {
            console.error('   Error checking data counts:', error.message);
            console.error('   Make sure your database tables exist');
        }

        console.log(`   - Restaurants: ${restaurantCount}`);
        console.log(`   - Menu items: ${menuCount}`);
        console.log(`   - Tables: ${tableCount}\n`);

        if (restaurantCount === 0) {
            console.error('❌ No restaurants found in database');
            console.error('   Please run sample_data.sql first to populate your database');
            process.exit(1);
        }

        // Generate embeddings
        console.log('🚀 Generating embeddings...');
        console.log('   This may take a few minutes depending on the amount of data...\n');

        const results = await RAGService.generateAllEmbeddings();

        console.log('✅ Embedding generation completed!\n');
        console.log('📈 Results:');
        console.log(`   - Restaurants: ${results.restaurants} embeddings generated`);
        console.log(`   - Menu items: ${results.menuItems} embeddings generated`);
        console.log(`   - Tables: ${results.tables} embeddings generated`);

        if (results.errors.length > 0) {
            console.log('\n⚠️  Some errors occurred:');
            results.errors.forEach(error => console.log(`   - ${error}`));
        }

        // Test the embeddings
        console.log('\n🧪 Testing embedding search...');
        
        try {
            // Test menu search
            const menuTest = await RAGService.hybridSearch(
                'seafood dish',
                'menu_item',
                { available: true },
                3
            );
            
            console.log(`   Menu search test: Found ${menuTest.length} results`);
            menuTest.forEach(item => {
                console.log(`      - ${item.name} (€${item.price}) - Score: ${item.relevanceScore.toFixed(3)}`);
            });

            // Test table search
            const tableTest = await RAGService.hybridSearch(
                'romantic dinner',
                'tables',
                {},
                2
            );
            
            console.log(`   Table search test: Found ${tableTest.length} results`);
            tableTest.forEach(table => {
                console.log(`      - ${table.table_type} (€${table.table_price}) - Score: ${table.relevanceScore.toFixed(3)}`);
            });

        } catch (error) {
            console.log('   ⚠️  Search test failed - check your data structure');
        }

        console.log('\n🎉 All done! Your embeddings are ready.');
        console.log('   The AI assistant will now use semantic search for better responses.');

    } catch (error) {
        console.error('\n❌ Error generating embeddings:', error.message);
        if (error.message.includes('embedding')) {
            console.error('   This might be due to API rate limits. Try running the script again.');
        }
        process.exit(1);
    }
}

// Handle script termination
process.on('SIGINT', () => {
    console.log('\n⏹️  Script interrupted. Some embeddings may be incomplete.');
    process.exit(0);
});

// Run the script
generateEmbeddings()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });