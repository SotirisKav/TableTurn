#!/bin/bash
# Data Refresh Script for Aichmi Database
# This script clears all data and reloads fresh sample data

echo "🔄 Starting Aichmi database refresh..."

# Clear all data from tables (in correct order due to foreign key constraints)
echo "🗑️  Clearing existing data..."
psql -d aichmi -c "
DELETE FROM response_templates;
DELETE FROM bot_modules;
DELETE FROM bot_config;
DELETE FROM fully_booked_dates;
DELETE FROM wedding_dates;
DELETE FROM reservation;
DELETE FROM owner;
DELETE FROM venue;
DELETE FROM customer;
DELETE FROM hotel;
DELETE FROM transfer_areas;
DELETE FROM tables;
"

if [ $? -eq 0 ]; then
    echo "✅ Data cleared successfully"
else
    echo "❌ Error clearing data"
    exit 1
fi

# Reload fresh sample data
echo "📥 Loading fresh sample data..."
psql -d aichmi -f ../../aichmi_db/sample_data.sql

if [ $? -eq 0 ]; then
    echo "✅ Sample data loaded successfully"
    echo "🎉 Database refresh complete!"
    
    # Show summary
    echo ""
    echo "📊 Data Summary:"
    psql -d aichmi -c "SELECT COUNT(*) as restaurants FROM venue WHERE type = 'restaurant';"
    psql -d aichmi -c "SELECT COUNT(*) as customers FROM customer;"
    psql -d aichmi -c "SELECT COUNT(*) as reservations FROM reservation;"
else
    echo "❌ Error loading sample data"
    exit 1
fi
