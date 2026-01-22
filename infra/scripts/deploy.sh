#!/bin/bash
# =============================================================================
# FILE: infra/scripts/deploy.sh
# PURPOSE: Production deployment script
# =============================================================================

set -e

echo "Starting deployment..."

# Check environment
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set"
    exit 1
fi

# Build application
echo "Building application..."
npm run build

# Run database migrations
echo "Running database migrations..."
npm run db:push

# Restart server
echo "Restarting server..."
pm2 restart food-safety-inspector || pm2 start dist/server/index.js --name food-safety-inspector

echo "Deployment complete!"
