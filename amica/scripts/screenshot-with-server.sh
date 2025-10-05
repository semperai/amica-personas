#!/bin/bash
# Screenshot with Dev Server Helper
# This script helps you take screenshots by managing the dev server

set -e

# Parse arguments
SCREENSHOT_ARGS=""
for arg in "$@"; do
  SCREENSHOT_ARGS="$SCREENSHOT_ARGS $arg"
done

# Check if dev server is running
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "✓ Dev server is already running"
  npm run screenshot -- $SCREENSHOT_ARGS
  exit 0
fi

echo "Dev server is not running."
echo ""
echo "You have two options:"
echo ""
echo "1. Start dev server in another terminal and run screenshot separately:"
echo "   Terminal 1: npm run dev"
echo "   Terminal 2: npm run screenshot $SCREENSHOT_ARGS"
echo ""
echo "2. Let this script start the dev server, take screenshot, and stop it:"
echo "   (Warning: This will start and stop the dev server)"
echo ""
read -p "Choose option (1/2) or press Ctrl+C to cancel: " choice

if [ "$choice" = "2" ]; then
  echo ""
  echo "Starting dev server..."
  npm run dev > /dev/null 2>&1 &
  DEV_SERVER_PID=$!

  # Wait for dev server to be ready
  echo "Waiting for dev server to be ready..."
  for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
      echo "✓ Dev server is ready"
      sleep 2  # Extra time for full initialization
      break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
      echo "❌ Dev server failed to start"
      kill $DEV_SERVER_PID 2>/dev/null || true
      exit 1
    fi
  done

  # Take screenshot
  echo ""
  echo "Taking screenshot..."
  npm run screenshot -- $SCREENSHOT_ARGS

  # Stop dev server
  echo ""
  echo "Stopping dev server..."
  kill $DEV_SERVER_PID 2>/dev/null || true

  echo "✓ Done!"
else
  echo ""
  echo "Please start the dev server in another terminal:"
  echo "  npm run dev"
  echo ""
  echo "Then run the screenshot command:"
  echo "  npm run screenshot $SCREENSHOT_ARGS"
fi
