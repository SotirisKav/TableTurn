#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  TableTurn Database Setup Script${NC}"
echo "=================================="

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
POSTGRES_SERVER="psql-tableturn.postgres.database.azure.com"
POSTGRES_ADMIN="tableturn_admin"
DATABASE_NAME="tableturn"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL client (psql) is not installed.${NC}"
    echo "Please install it first:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Prompt for database password
echo -e "${YELLOW}🔐 Enter PostgreSQL admin password:${NC}"
read -s POSTGRES_PASSWORD
echo

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "${RED}❌ PostgreSQL password cannot be empty${NC}"
    exit 1
fi

# Connection string
CONNECTION_STRING="postgresql://${POSTGRES_ADMIN}:${POSTGRES_PASSWORD}@${POSTGRES_SERVER}:5432/${DATABASE_NAME}?sslmode=require"

echo -e "${BLUE}🔍 Testing database connection...${NC}"
if ! psql "$CONNECTION_STRING" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}❌ Failed to connect to database. Please check your credentials and network access.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database connection successful!${NC}"

# Enable pgvector extension
echo -e "${BLUE}🔌 Enabling pgvector extension...${NC}"
psql "$CONNECTION_STRING" -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run DDL script
echo -e "${BLUE}🏗️  Creating database schema...${NC}"
if [ -f "$PROJECT_ROOT/database/tableturn_ddl.sql" ]; then
    psql "$CONNECTION_STRING" -f "$PROJECT_ROOT/database/tableturn_ddl.sql"
    echo -e "${GREEN}✅ Schema created successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  DDL file not found. Skipping schema creation.${NC}"
fi

# Run sample data script
echo -e "${BLUE}📊 Loading sample data...${NC}"
if [ -f "$PROJECT_ROOT/database/sample_data.sql" ]; then
    psql "$CONNECTION_STRING" -f "$PROJECT_ROOT/database/sample_data.sql"
    echo -e "${GREEN}✅ Sample data loaded successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Sample data file not found. Skipping data load.${NC}"
fi

# Verify setup
echo -e "${BLUE}🔍 Verifying database setup...${NC}"
TABLE_COUNT=$(psql "$CONNECTION_STRING" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "Tables created: $TABLE_COUNT"

EXTENSION_CHECK=$(psql "$CONNECTION_STRING" -t -c "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector');")
if [[ "$EXTENSION_CHECK" =~ "t" ]]; then
    echo -e "${GREEN}✅ pgvector extension is enabled${NC}"
else
    echo -e "${RED}❌ pgvector extension is not enabled${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Database setup completed successfully!${NC}"
echo ""
echo "📋 Connection Details:"
echo "======================"
echo "Server: $POSTGRES_SERVER"
echo "Database: $DATABASE_NAME"
echo "Username: $POSTGRES_ADMIN"
echo "SSL Mode: Required"
echo ""
echo "🔗 Connection String (for .env file):"
echo "DATABASE_URL=\"$CONNECTION_STRING\""