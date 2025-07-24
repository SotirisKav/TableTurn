# AICHMI Embedding Setup Guide

This guide explains how to populate your database and generate embeddings for optimal AI performance.

## Quick Setup

1. **Populate your database with sample data:**
   ```bash
   cd aichmi_db
   psql -d your_database_name -f aichmi_ddl.sql
   psql -d your_database_name -f sample_data.sql
   ```

2. **Generate embeddings for semantic search:**
   ```bash
   cd aichmi_backend
   node generate-embeddings.js
   ```

## What This Does

### Database Population
- `aichmi_ddl.sql` creates the database schema with embedding support
- `sample_data.sql` populates your database with restaurants, menu items, and tables
- All tables include `embedding vector(768)` columns for semantic search

### Embedding Generation
- `generate-embeddings.js` creates vector embeddings for all your data
- Uses Google Gemini's text-embedding-004 model
- Enables semantic search capabilities in your AI assistant

## Requirements

- PostgreSQL with pgvector extension
- Node.js environment with your project dependencies
- `GEMINI_API_KEY` in your `.env` file

## AI Assistant Improvements

After running these scripts, your AI assistant will:
- Give more concise, natural responses (fixed system prompt)
- Use semantic search to find relevant menu items and tables
- Provide better recommendations based on user queries
- Handle ambiguous requests more intelligently

## Files Changed/Added

- ✅ **Fixed**: `aichmi_backend/services/AIService.js` - More natural conversation style
- ✅ **Added**: `aichmi_backend/generate-embeddings.js` - Embedding generation script
- ✅ **Removed**: `aichmi_backend/setup-simple.js` - Replaced with your SQL approach

## Usage Example

After setup, test your AI with queries like:
- "What vegan options do you have?"
- "I want a romantic table for dinner"
- "What's your best seafood dish?"

The AI will now use semantic search to find the most relevant results!