#!/bin/bash

# Build all Amica versions defined in versions.config.sh
# This script reads the version configuration and builds each version

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBDOMAIN_SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SUBDOMAIN_SERVICE_DIR/versions.config.sh"

# Load version configuration
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Configuration file not found: $CONFIG_FILE"
  echo ""
  echo "Please create versions.config.sh with your version definitions."
  echo "See versions.config.sh.example for reference."
  exit 1
fi

source "$CONFIG_FILE"

echo "================================================"
echo "Building All Amica Versions"
echo "================================================"
echo ""
echo "Configuration:"
echo "  Versions to build: ${#AMICA_VERSIONS[@]}"
echo "  Parallel builds:   $BUILD_PARALLEL"
echo "  Clean builds:      $CLEAN_BEFORE_BUILD"
echo ""

# Clean old builds if configured
if [ "$CLEAN_BEFORE_BUILD" = true ]; then
  echo "Cleaning old builds..."
  rm -rf "$SUBDOMAIN_SERVICE_DIR/builds/amica_v"*
  echo ""
fi

# Track build results
SUCCESSFUL_BUILDS=()
FAILED_BUILDS=()

# Function to build a single version
build_version() {
  local VERSION_CONFIG=$1
  local VERSION=$(echo "$VERSION_CONFIG" | cut -d: -f1)
  local GIT_REF=$(echo "$VERSION_CONFIG" | cut -d: -f2)

  echo "------------------------------------------------"
  echo "Building version $VERSION from $GIT_REF"
  echo "------------------------------------------------"

  if "$SCRIPT_DIR/build-version.sh" "$VERSION" "$GIT_REF"; then
    SUCCESSFUL_BUILDS+=("$VERSION ($GIT_REF)")
    return 0
  else
    FAILED_BUILDS+=("$VERSION ($GIT_REF)")
    return 1
  fi
}

# Build versions
if [ "$BUILD_PARALLEL" = true ]; then
  echo "Building versions in parallel..."
  echo ""

  PIDS=()
  for VERSION_CONFIG in "${AMICA_VERSIONS[@]}"; do
    build_version "$VERSION_CONFIG" &
    PIDS+=($!)
  done

  # Wait for all builds to complete
  for PID in "${PIDS[@]}"; do
    wait "$PID" || true
  done
else
  echo "Building versions sequentially..."
  echo ""

  for VERSION_CONFIG in "${AMICA_VERSIONS[@]}"; do
    build_version "$VERSION_CONFIG" || true
    echo ""
  done
fi

# Print summary
echo ""
echo "================================================"
echo "Build Summary"
echo "================================================"
echo ""

if [ ${#SUCCESSFUL_BUILDS[@]} -gt 0 ]; then
  echo "✓ Successful builds (${#SUCCESSFUL_BUILDS[@]}):"
  for BUILD in "${SUCCESSFUL_BUILDS[@]}"; do
    echo "  - $BUILD"
  done
  echo ""
fi

if [ ${#FAILED_BUILDS[@]} -gt 0 ]; then
  echo "✗ Failed builds (${#FAILED_BUILDS[@]}):"
  for BUILD in "${FAILED_BUILDS[@]}"; do
    echo "  - $BUILD"
  done
  echo ""
  exit 1
fi

echo "All builds completed successfully!"
echo ""
echo "Available versions:"
ls -1d "$SUBDOMAIN_SERVICE_DIR/builds/amica_v"* 2>/dev/null | while read -r dir; do
  VERSION=$(basename "$dir" | sed 's/amica_v//')
  if [ -f "$dir/.version-info" ]; then
    echo "  - Version $VERSION:"
    grep "commit:" "$dir/.version-info" | sed 's/^/    /'
    grep "built_at:" "$dir/.version-info" | sed 's/^/    /'
  else
    echo "  - Version $VERSION (no version info)"
  fi
done
echo ""
echo "Start the service with: npm run dev"
