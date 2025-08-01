#!/bin/bash

# Exit on error
set -e

# Database connection variables (edit as needed)
DB_NAME="aichmi"
DB_USER="sotiriskavadakis"
DB_HOST="localhost"
DB_PORT="5432"
SAMPLE_SQL="./sample_data.sql"

# Optional: Prompt for confirmation
read -p "This will DELETE ALL DATA in your database '$DB_NAME'. Are you sure? (y/N): " confirm
if [[ $confirm != "y" && $confirm != "Y" ]]; then
  echo "Aborted."
  exit 1
fi

# Get all table names in the public schema, except for schema_migrations (if using)
TABLES=$(psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -Atc "SELECT tablename FROM pg_tables WHERE schemaname='public';")

# Disable foreign key checks, truncate all tables, then re-enable
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "SET session_replication_role = 'replica';"
for tbl in $TABLES; do
  psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "TRUNCATE TABLE \"$tbl\" RESTART IDENTITY CASCADE;"
done
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "SET session_replication_role = 'origin';"

echo "All tables truncated. Now loading sample data..."

# Run the sample data SQL
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -f "$SAMPLE_SQL"

echo "Database refresh complete!"
