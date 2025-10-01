#!/bin/bash

# Setup script for Amica Subdomain Service
# This script helps you get started quickly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBDOMAIN_SERVICE_DIR="$(dirname "$SCRIPT_DIR")"

echo "================================================"
echo "Amica Subdomain Service Setup"
echo "================================================"
echo ""

# Install dependencies
cd "$SUBDOMAIN_SERVICE_DIR"

echo "Installing subdomain service dependencies..."
npm install

echo ""
echo "Building TypeScript..."
npm run build

# Check if .env exists
if [ ! -f ".env" ]; then
  echo ""
  echo "Creating .env file from .env.example..."
  cp .env.example .env
  echo "✓ .env created"
  echo ""
  echo "Please review and update .env with your configuration:"
  echo "  $SUBDOMAIN_SERVICE_DIR/.env"
else
  echo ""
  echo "✓ .env already exists"
fi

# Build Amica v1
echo ""
read -p "Do you want to build Amica v1 now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  ./scripts/build-amica-version.sh 1
fi

echo ""
echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Review .env configuration"
echo "  2. Run the development server:"
echo "     npm run dev"
echo ""
echo "  3. Test with local hosts:"
echo "     Add to /etc/hosts:"
echo "     127.0.0.1 test-persona.amica.bot"
echo ""
echo "  4. Visit: http://test-persona.amica.bot:3001"
echo ""
