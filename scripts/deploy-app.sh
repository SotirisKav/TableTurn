#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 AICHMI Local Deployment Script${NC}"
echo "================================="

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
APP_NAME="aichmi-app"
RESOURCE_GROUP="rg-aichmi-prod"

# Check if Azure CLI is installed and logged in
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure. Please run 'az login' first.${NC}"
    exit 1
fi

# Build frontend
echo -e "${BLUE}🔨 Building frontend...${NC}"
cd "$PROJECT_ROOT/aichmi_frontend"
npm ci
npm run build

# Copy frontend build to backend public directory
echo -e "${BLUE}📋 Copying frontend to backend...${NC}"
cd "$PROJECT_ROOT/aichmi_backend"
rm -rf public/*
mkdir -p public
cp -r ../aichmi_frontend/dist/* public/

# Install backend dependencies
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
npm ci --only=production

# Create deployment package
echo -e "${BLUE}📦 Creating deployment package...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ZIP_NAME="aichmi-deploy-${TIMESTAMP}.zip"

zip -r "$ZIP_NAME" . \
    -x "node_modules/.cache/*" \
    -x "*.log" \
    -x ".env*" \
    -x "*.zip" \
    -x ".git/*"

# Deploy to Azure App Service
echo -e "${BLUE}🚀 Deploying to Azure...${NC}"
az webapp deployment source config-zip \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --src "$ZIP_NAME"

# Wait for deployment
echo -e "${YELLOW}⏳ Waiting for deployment to complete...${NC}"
sleep 10

# Check deployment status
APP_URL=$(az webapp show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --query 'defaultHostName' \
    --output tsv)

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📋 Deployment Summary:"
echo "======================"
echo "App URL: https://$APP_URL"
echo "Deployment Package: $ZIP_NAME"
echo ""
echo -e "${YELLOW}🔍 Testing deployment...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "https://$APP_URL" | grep -q "200\|302\|401"; then
    echo -e "${GREEN}✅ App is responding!${NC}"
else
    echo -e "${YELLOW}⚠️  App might still be starting up. Check the Azure portal for logs.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Local deployment completed!${NC}"

# Cleanup option
read -p "Delete deployment package? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm "$ZIP_NAME"
    echo -e "${GREEN}✅ Deployment package cleaned up.${NC}"
fi