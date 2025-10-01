#!/bin/bash

# Script to build and copy Amica versions
# Usage: ./scripts/build-amica-version.sh <version>
# Example: ./scripts/build-amica-version.sh 1

set -e

VERSION=${1:-1}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBDOMAIN_SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
AMICA_DIR="$SUBDOMAIN_SERVICE_DIR/../amica"
BUILD_OUTPUT_DIR="$SUBDOMAIN_SERVICE_DIR/builds/amica_v${VERSION}"

echo "================================================"
echo "Building Amica Version ${VERSION}"
echo "================================================"
echo ""
echo "Amica directory: $AMICA_DIR"
echo "Output directory: $BUILD_OUTPUT_DIR"
echo ""

# Check if amica directory exists
if [ ! -d "$AMICA_DIR" ]; then
  echo "Error: Amica directory not found at $AMICA_DIR"
  exit 1
fi

# Navigate to amica directory
cd "$AMICA_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build Amica
echo "Building Amica..."
npm run build

# Export static files
echo "Exporting static files..."
if [ -d "out" ]; then
  rm -rf out
fi
npm run export

# Create output directory
echo "Creating output directory..."
mkdir -p "$BUILD_OUTPUT_DIR"

# Copy exported files
echo "Copying build files..."
cp -r out/* "$BUILD_OUTPUT_DIR/"

# Verify the build
if [ -f "$BUILD_OUTPUT_DIR/index.html" ]; then
  echo ""
  echo "================================================"
  echo "✓ Build successful!"
  echo "================================================"
  echo ""
  echo "Amica v${VERSION} has been built to:"
  echo "$BUILD_OUTPUT_DIR"
  echo ""
  echo "You can now start the subdomain service:"
  echo "  cd $SUBDOMAIN_SERVICE_DIR"
  echo "  npm run dev"
else
  echo ""
  echo "================================================"
  echo "✗ Build failed!"
  echo "================================================"
  echo ""
  echo "index.html not found in output directory."
  echo "Please check the Amica build configuration."
  exit 1
fi
