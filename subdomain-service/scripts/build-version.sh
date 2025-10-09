#!/bin/bash

# Script to build Amica from a specific git commit/tag and deploy to builds/
# Usage: ./scripts/build-version.sh <version_number> [git_ref]
# Examples:
#   ./scripts/build-version.sh 1 main
#   ./scripts/build-version.sh 2 v1.2.3
#   ./scripts/build-version.sh 3 abc123def

set -e

VERSION=${1}
GIT_REF=${2:-main}

if [ -z "$VERSION" ]; then
  echo "Error: Version number required"
  echo "Usage: ./scripts/build-version.sh <version_number> [git_ref]"
  echo ""
  echo "Examples:"
  echo "  ./scripts/build-version.sh 1 main"
  echo "  ./scripts/build-version.sh 2 v1.2.3"
  echo "  ./scripts/build-version.sh 3 abc123def"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBDOMAIN_SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
AMICA_DIR="$SUBDOMAIN_SERVICE_DIR/../amica"
BUILD_OUTPUT_DIR="$SUBDOMAIN_SERVICE_DIR/builds/amica_v${VERSION}"

echo "================================================"
echo "Building Amica Version ${VERSION} from ${GIT_REF}"
echo "================================================"
echo ""
echo "Amica directory: $AMICA_DIR"
echo "Git reference:   $GIT_REF"
echo "Output directory: $BUILD_OUTPUT_DIR"
echo ""

# Check if amica directory exists
if [ ! -d "$AMICA_DIR" ]; then
  echo "Error: Amica directory not found at $AMICA_DIR"
  exit 1
fi

# Navigate to amica directory
cd "$AMICA_DIR"

# Ensure we're in a git repository
if [ ! -d ".git" ]; then
  echo "Error: $AMICA_DIR is not a git repository"
  exit 1
fi

# Stash any local changes
echo "Stashing local changes..."
git stash push -m "Auto-stash before building version ${VERSION}"

# Fetch latest changes
echo "Fetching latest changes..."
git fetch --all --tags

# Checkout the specified reference
echo "Checking out ${GIT_REF}..."
git checkout "$GIT_REF"

# Get the actual commit hash for logging
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B | head -n 1)
echo ""
echo "Building from commit: $COMMIT_HASH"
echo "Commit message: $COMMIT_MSG"
echo ""

# Clean node_modules and reinstall to ensure dependencies match this version
echo "Installing dependencies..."
rm -rf node_modules
npm install

# Build Amica
echo "Building Amica..."
npm run build

# Create output directory
echo "Creating output directory..."
mkdir -p "$BUILD_OUTPUT_DIR"

# Remove old build if it exists
if [ -d "$BUILD_OUTPUT_DIR" ] && [ "$(ls -A $BUILD_OUTPUT_DIR)" ]; then
  echo "Removing previous build..."
  rm -rf "${BUILD_OUTPUT_DIR:?}"/*
fi

# Copy build files (adjust based on Amica's actual build output)
echo "Copying build files..."
if [ -d "dist" ]; then
  cp -r dist/* "$BUILD_OUTPUT_DIR/"
elif [ -d "out" ]; then
  cp -r out/* "$BUILD_OUTPUT_DIR/"
elif [ -d "build" ]; then
  cp -r build/* "$BUILD_OUTPUT_DIR/"
else
  echo "Error: Could not find build output directory (tried: dist, out, build)"
  exit 1
fi

# Create version info file
cat > "$BUILD_OUTPUT_DIR/.version-info" <<EOF
version: ${VERSION}
git_ref: ${GIT_REF}
commit: ${COMMIT_HASH}
commit_message: ${COMMIT_MSG}
built_at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
EOF

# Verify the build
if [ -f "$BUILD_OUTPUT_DIR/index.html" ]; then
  echo ""
  echo "================================================"
  echo "✓ Build successful!"
  echo "================================================"
  echo ""
  echo "Amica v${VERSION} has been built to:"
  echo "  $BUILD_OUTPUT_DIR"
  echo ""
  echo "Version info:"
  cat "$BUILD_OUTPUT_DIR/.version-info"
  echo ""
  echo "To use this version, set 'amica_version: \"${VERSION}\"' in persona metadata"
  echo ""
else
  echo ""
  echo "================================================"
  echo "✗ Build failed!"
  echo "================================================"
  echo ""
  echo "index.html not found in output directory."
  exit 1
fi

# Return to original branch
echo "Returning to main branch..."
git checkout main

# Pop stashed changes if any
if git stash list | grep -q "Auto-stash before building version ${VERSION}"; then
  echo "Restoring stashed changes..."
  git stash pop
fi

echo ""
echo "Done!"
