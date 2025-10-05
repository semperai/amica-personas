# Amica Screenshot Tool

Automated screenshot tool for capturing clean images of your Amica character without UI elements.

## Features

- 🎯 **Clean screenshots** - Automatically hides all UI elements (navbar, buttons, chat, etc.)
- ⚙️ **Config overrides** - Override any Amica configuration via command-line arguments
- 📐 **Custom dimensions** - Set custom screenshot width and height
- 🎨 **High quality** - Uses 2x device pixel ratio for crisp images
- 🤖 **Headless mode** - Runs in background by default (can be disabled)

## Prerequisites

**The dev server must be running before taking screenshots.**

### Option 1: Manual (Recommended)
In one terminal, start the dev server:
```bash
npm run dev
```

In another terminal, take screenshots:
```bash
npm run screenshot
```

### Option 2: Helper Script
Use the helper script that can optionally start/stop the dev server for you:
```bash
./scripts/screenshot-with-server.sh
```

The screenshot script will automatically check if the dev server is running and show a helpful error if it's not.

## Basic Usage

### Simple screenshot
```bash
npm run screenshot
```

This creates `amica-screenshot.png` in your current directory with default settings (1920x1080).

### Custom output path
```bash
npm run screenshot -- --output=my-amica.png
```

### Custom dimensions
```bash
npm run screenshot -- --width=2560 --height=1440
```

## Config Overrides

You can override **any** Amica configuration option. Just use `--<config_key>=<value>`.

### Change VRM model
```bash
npm run screenshot -- --vrm_url=/vrm/custom.vrm
```

### Change background
```bash
npm run screenshot -- --bg_color=#ffffff --bg_url=/bg/custom.jpg
```

### Multiple overrides
```bash
npm run screenshot -- \
  --vrm_url=/vrm/model.vrm \
  --bg_color=#ff0000 \
  --name=CustomAmica \
  --output=custom.png
```

## All Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output` | Output file path | `amica-screenshot.png` |
| `--width` | Screenshot width in pixels | `1920` |
| `--height` | Screenshot height in pixels | `1080` |
| `--wait` | Additional wait time (ms) after load | `3000` |
| `--headless` | Run in headless mode | `true` |
| `--<config_key>` | Any valid Amica config key | - |

### Common Config Keys

Here are some commonly used config keys you can override:

- `vrm_url` - Path to VRM model file
- `bg_color` - Background color (hex)
- `bg_url` - Background image URL
- `animation_url` - Animation file URL
- `name` - Character name
- `system_prompt` - AI system prompt

For a complete list of config keys, see `src/types/config.ts`.

## Examples

### High-resolution screenshot for social media
```bash
npm run screenshot -- \
  --output=social-media.png \
  --width=2560 \
  --height=1440
```

### Screenshot with custom character
```bash
npm run screenshot -- \
  --vrm_url=/vrm/my-character.vrm \
  --bg_color=#ffffff \
  --output=character-showcase.png
```

### Multiple screenshots with different configs
```bash
# Different VRM models
npm run screenshot -- --vrm_url=/vrm/model1.vrm --output=model1.png
npm run screenshot -- --vrm_url=/vrm/model2.vrm --output=model2.png
npm run screenshot -- --vrm_url=/vrm/model3.vrm --output=model3.png
```

### Screenshot with longer wait time (for complex scenes)
```bash
npm run screenshot -- --wait=5000 --output=complex-scene.png
```

### Watch the browser while capturing (debugging)
```bash
npm run screenshot -- --headless=false
```

## Troubleshooting

### "Dev server is not running"
Make sure you have `npm run dev` running in another terminal before taking screenshots.

### Screenshot is blank or incomplete
Try increasing the wait time:
```bash
npm run screenshot -- --wait=5000
```

### VRM model not loading
Verify the VRM path is correct and the file exists in your `public` directory.

### Screenshot shows UI elements
The script should automatically hide UI elements. If you still see them, please report this as a bug.

## Automated Usage

You can use this script in automation workflows:

```bash
#!/bin/bash
# Generate screenshots for all VRM models

for vrm in public/vrm/*.vrm; do
  filename=$(basename "$vrm" .vrm)
  npm run screenshot -- \
    --vrm_url="/vrm/$filename.vrm" \
    --output="screenshots/$filename.png"
done
```

## Technical Details

The screenshot tool:
1. Launches a Chromium browser using Playwright
2. Navigates to your local dev server with config overrides as URL parameters
3. Waits for the canvas and VRM model to load
4. Hides all UI elements via JavaScript
5. Takes a high-quality screenshot
6. Closes the browser

Config overrides are passed as URL parameters and have the highest priority in the config system.

### Config Override System

Amica now supports config overrides via URL parameters. This means you can also manually override config in your browser:

```
http://localhost:5173/?vrm_url=/vrm/custom.vrm&bg_color=#ffffff
```

The config priority order is:
1. **URL parameters** (highest priority) - For screenshot tool and manual browser overrides
2. **/config endpoint** - From amica.toml or subdomain service
3. **Defaults** - Built-in default values

This applies to both the screenshot tool and when running Amica normally in the browser.

## Need Help?

Run the help command:
```bash
npm run screenshot -- --help
```
