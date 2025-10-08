#!/bin/bash
set -euo pipefail
# Screenshot Examples for Amica
# Make sure to run `npm run dev` in another terminal before running these examples

echo "=== Amica Screenshot Examples ==="
echo ""
echo "Make sure 'npm run dev' is running in another terminal!"
echo ""
read -p "Press Enter to continue..."

# Example 1: Basic screenshot
echo ""
echo "1. Taking a basic screenshot..."
npm run screenshot

# Example 2: High-resolution screenshot
echo ""
echo "2. Taking a high-resolution screenshot (2560x1440)..."
npm run screenshot -- --output=high-res.png --width=2560 --height=1440

# Example 3: Screenshot with different background color
echo ""
echo "3. Taking a screenshot with white background..."
npm run screenshot -- --output=white-bg.png --bg_color=#ffffff

# Example 4: Screenshot with custom VRM (if you have one)
echo ""
echo "4. Taking a screenshot with custom VRM..."
echo "   (Edit this script to change the VRM path)"
# Uncomment and modify the line below with your VRM path
# npm run screenshot -- --output=custom-vrm.png --vrm_url=/vrm/your-model.vrm

# Example 5: Screenshot with longer wait time
echo ""
echo "5. Taking a screenshot with longer wait time (5 seconds)..."
npm run screenshot -- --output=long-wait.png --wait=5000

echo ""
echo "=== Screenshots completed! ==="
echo ""
echo "Generated files:"
ls -lh *.png
