#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 TableTurn Azure Deployment Script${NC}"
echo "=================================="

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure. Please run 'az login' first.${NC}"
    exit 1
fi

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parameters
RESOURCE_GROUP_NAME="rg-tableturn-prod"
LOCATION="francecentral"
DEPLOYMENT_NAME="tableturn-deployment-$(date +%Y%m%d-%H%M%S)"

# Get user's public IP
echo -e "${YELLOW}🔍 Getting your public IP address...${NC}"
MY_IP=$(curl -s https://ipinfo.io/ip)
if [ -z "$MY_IP" ]; then
    echo -e "${RED}❌ Could not determine your public IP address${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Your IP address: $MY_IP${NC}"

# Prompt for PostgreSQL password
echo -e "${YELLOW}🔐 Enter PostgreSQL admin password (will be hidden):${NC}"
read -s POSTGRES_PASSWORD
echo

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "${RED}❌ PostgreSQL password cannot be empty${NC}"
    exit 1
fi

# Create resource group
echo -e "${YELLOW}📦 Creating resource group...${NC}"
az group create \
    --name "$RESOURCE_GROUP_NAME" \
    --location "$LOCATION" \
    --output table

# Deploy infrastructure
echo -e "${YELLOW}🏗️  Deploying infrastructure... (This may take several minutes)${NC}"
az deployment group create \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --template-file "$SCRIPT_DIR/main.bicep" \
    --parameters \
        postgresAdminPassword="$POSTGRES_PASSWORD" \
        myIpAddress="$MY_IP" \
    --name "$DEPLOYMENT_NAME" \
    --output table

echo -e "${YELLOW}⏳ Waiting for deployment to complete...${NC}"
az deployment group wait \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --name "$DEPLOYMENT_NAME" \
    --created

# Get deployment outputs
echo -e "${YELLOW}📋 Getting deployment information...${NC}"
APP_URL=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --name "$DEPLOYMENT_NAME" \
    --query 'properties.outputs.appServiceUrl.value' \
    --output tsv)

POSTGRES_SERVER=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --name "$DEPLOYMENT_NAME" \
    --query 'properties.outputs.postgresServerName.value' \
    --output tsv)

APP_NAME=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --name "$DEPLOYMENT_NAME" \
    --query 'properties.outputs.appServiceName.value' \
    --output tsv)

# Build and deploy application
echo -e "${YELLOW}🔨 Building frontend...${NC}"
cd "$PROJECT_ROOT/frontend"
npm ci
npm run build

echo -e "${YELLOW}📤 Deploying application...${NC}"
cd "$PROJECT_ROOT/backend"

# Create deployment package
zip -r ../tableturn-deploy.zip . -x "node_modules/*" ".env*"
cd "$PROJECT_ROOT/frontend/dist"
zip -r ../../tableturn-deploy.zip .

cd "$PROJECT_ROOT"

# Deploy to App Service
az webapp deployment source config-zip \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --name "$APP_NAME" \
    --src tableturn-deploy.zip

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📋 Deployment Summary:"
echo "======================"
echo "App URL: $APP_URL"
echo "PostgreSQL Server: $POSTGRES_SERVER"
echo "Resource Group: $RESOURCE_GROUP_NAME"
echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. Set up your environment variables in the App Service"
echo "2. Initialize the database schema"
echo "3. Configure your domain and SSL certificate (optional)"
echo ""
echo -e "${GREEN}🎉 Your TableTurn application is now deployed!${NC}"

# Cleanup
rm -f tableturn-deploy.zip
