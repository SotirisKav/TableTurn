#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}⚙️  TableTurn Parameters Update Script${NC}"
echo "==================================="

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"

# Parameters file
PARAMETERS_FILE="$INFRASTRUCTURE_DIR/parameters.json"

# Check if parameters file exists
if [ ! -f "$PARAMETERS_FILE" ]; then
    echo -e "${RED}❌ Parameters file not found: $PARAMETERS_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Current parameters file: $PARAMETERS_FILE${NC}"

# Get current IP address
echo -e "${YELLOW}🔍 Getting your current public IP address...${NC}"
CURRENT_IP=$(curl -s https://ipinfo.io/ip)
if [ -z "$CURRENT_IP" ]; then
    echo -e "${RED}❌ Could not determine your public IP address${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Your current IP: $CURRENT_IP${NC}"

# Read current IP from parameters file
CURRENT_PARAM_IP=$(grep -o '"myIpAddress":[^"]*"[^"]*"' "$PARAMETERS_FILE" | cut -d'"' -f4)

echo ""
echo "📊 IP Address Comparison:"
echo "========================"
echo "Current IP:    $CURRENT_IP"
echo "Parameters IP: $CURRENT_PARAM_IP"

if [ "$CURRENT_IP" = "$CURRENT_PARAM_IP" ]; then
    echo -e "${GREEN}✅ IP addresses match. No update needed.${NC}"
else
    echo -e "${YELLOW}⚠️  IP addresses differ. Update needed.${NC}"
    
    # Confirm update
    read -p "Update parameters file with current IP? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Create backup
        cp "$PARAMETERS_FILE" "$PARAMETERS_FILE.bak"
        echo -e "${BLUE}💾 Backup created: $PARAMETERS_FILE.bak${NC}"
        
        # Update IP address
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/\"myIpAddress\": {[^}]*}/\"myIpAddress\": {\"value\": \"$CURRENT_IP\"}/" "$PARAMETERS_FILE"
        else
            # Linux
            sed -i "s/\"myIpAddress\": {[^}]*}/\"myIpAddress\": {\"value\": \"$CURRENT_IP\"}/" "$PARAMETERS_FILE"
        fi
        
        echo -e "${GREEN}✅ Parameters file updated successfully!${NC}"
    else
        echo -e "${YELLOW}⏭️  Skipping IP update.${NC}"
    fi
fi

# Option to update other parameters
echo ""
echo -e "${BLUE}🔧 Other parameter updates available:${NC}"
echo "1. PostgreSQL password"
echo "2. Resource names"
echo "3. View current parameters"
echo "4. Exit"

read -p "Select option (1-4): " -n 1 -r
echo

case $REPLY in
    1)
        echo -e "${YELLOW}🔐 Enter new PostgreSQL admin password:${NC}"
        read -s NEW_PASSWORD
        echo
        if [ ! -z "$NEW_PASSWORD" ]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/\"postgresAdminPassword\": {[^}]*}/\"postgresAdminPassword\": {\"value\": \"$NEW_PASSWORD\"}/" "$PARAMETERS_FILE"
            else
                sed -i "s/\"postgresAdminPassword\": {[^}]*}/\"postgresAdminPassword\": {\"value\": \"$NEW_PASSWORD\"}/" "$PARAMETERS_FILE"
            fi
            echo -e "${GREEN}✅ PostgreSQL password updated!${NC}"
        fi
        ;;
    2)
        echo -e "${YELLOW}⚠️  Changing resource names will create new resources. Current resources will remain.${NC}"
        echo "Current app name:"
        grep -o '"appName":[^"]*"[^"]*"' "$PARAMETERS_FILE" | cut -d'"' -f4
        read -p "Enter new app name (or press Enter to skip): " NEW_APP_NAME
        if [ ! -z "$NEW_APP_NAME" ]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/\"appName\": {[^}]*}/\"appName\": {\"value\": \"$NEW_APP_NAME\"}/" "$PARAMETERS_FILE"
            else
                sed -i "s/\"appName\": {[^}]*}/\"appName\": {\"value\": \"$NEW_APP_NAME\"}/" "$PARAMETERS_FILE"
            fi
            echo -e "${GREEN}✅ App name updated to: $NEW_APP_NAME${NC}"
        fi
        ;;
    3)
        echo -e "${BLUE}📋 Current parameters:${NC}"
        cat "$PARAMETERS_FILE" | jq '.' 2>/dev/null || cat "$PARAMETERS_FILE"
        ;;
    4)
        echo -e "${GREEN}👋 Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${YELLOW}⚠️  Invalid option selected.${NC}"
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Parameter update completed!${NC}"