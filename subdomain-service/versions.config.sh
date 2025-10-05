#!/bin/bash

# Amica Version Configuration
# Define which Amica versions to build and deploy
#
# Format: VERSION_NUMBER:GIT_REF
# - VERSION_NUMBER: The version identifier used in persona metadata (e.g., "1", "2", "beta")
# - GIT_REF: Git commit hash, tag, or branch name
#
# Examples:
#   "1:v1.0.0"          - Version 1 from tag v1.0.0
#   "2:main"            - Version 2 from main branch
#   "3:feature-branch"  - Version 3 from a feature branch
#   "beta:abc123"       - Beta version from commit abc123

AMICA_VERSIONS=(
  "1:main"              # Default/stable version
  # "2:v2.0.0"          # Uncomment and set when v2 is ready
  # "beta:develop"      # Uncomment for beta builds
)

# Build configuration
BUILD_PARALLEL=false    # Set to true to build versions in parallel (faster but uses more resources)
CLEAN_BEFORE_BUILD=true # Remove old builds before creating new ones
