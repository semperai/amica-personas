# Amica Subdomain Service

A TypeScript service that dynamically serves Amica persona frontends based on subdomain lookups.

## How it works

1. User visits `cool-agent.amica.bot`
2. Server parses subdomain (`cool-agent`)
3. Queries GraphQL API for persona with domain `cool-agent` on Arbitrum One
4. Loads persona metadata (name, system_prompt, vrm_url, etc.)
5. Checks `amica_version` metadata (defaults to `1`)
6. Serves the appropriate Amica build from `builds/amica_v{version}/`
7. Amica frontend loads and fetches `/config` endpoint
8. Server returns persona-specific configuration as JSON

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Build Amica version(s)
# Option A: Build single version
./scripts/build-version.sh 1 main

# Option B: Build all configured versions
./scripts/build-all-versions.sh

# 4. Run the service
npm run dev
```

Visit `http://localhost:3001` to see the landing page.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and configure:

```bash
GRAPHQL_ENDPOINT=https://squid.subsquid.io/amica-personas/graphql
PORT=3001
CHAIN_ID=42161
ALLOWED_ORIGINS=https://amica.bot,http://localhost:3000
```

### 3. Build Amica versions

Configure which versions to build in `versions.config.sh`:

```bash
AMICA_VERSIONS=(
  "1:main"              # Default version
  # "2:v2.0.0"          # Add more versions as needed
)
```

Build all configured versions:

```bash
./scripts/build-all-versions.sh
```

Or build a single version:

```bash
./scripts/build-version.sh <version> <git-ref>
```

### 4. Run the service

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## Testing

Run tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

Coverage report:
```bash
npm run test:coverage
```

## Directory Structure

```
subdomain-service/
├── src/
│   ├── server.ts              # Main Express server
│   ├── types.ts               # TypeScript interfaces
│   ├── graphql.ts             # GraphQL queries
│   ├── utils.ts               # Helper functions
│   ├── amica-config-keys.ts   # Valid Amica config keys
│   └── __tests__/             # Test files
│       ├── utils.test.ts
│       ├── amica-config-keys.test.ts
│       ├── graphql.test.ts
│       └── server.test.ts
├── scripts/
│   ├── build-version.sh       # Build single Amica version from git ref
│   ├── build-all-versions.sh  # Build all configured versions
│   └── setup.sh               # Initial setup
├── builds/
│   ├── amica_v1/              # Amica version 1 build
│   │   ├── index.html
│   │   ├── assets/
│   │   └── .version-info      # Build metadata
│   └── amica_v2/              # Version 2 build
├── versions.config.sh         # Version configuration
├── package.json
├── tsconfig.json
├── vitest.config.mts
└── .env
```

## Version Management

The service serves different Amica builds based on the `amica_version` metadata key:

### How version selection works

1. Server reads `amica_version` from persona metadata (defaults to `"1"`)
2. Looks for build directory: `builds/amica_v{version}/`
3. Serves all static files from that version's directory
4. If version doesn't exist, returns "Version Not Available" page

### Setting up different Amica versions

Place built Amica frontends in version-specific directories:

```
builds/
├── amica_v1/          # Default version
│   ├── index.html
│   ├── assets/
│   └── ...
├── amica_v2/          # Experimental version
│   ├── index.html
│   ├── assets/
│   └── ...
```

### Building a new version

#### Option 1: Using the build script (Recommended)

```bash
# Build version 1 from main branch
./scripts/build-version.sh 1 main

# Build version 2 from a specific tag
./scripts/build-version.sh 2 v2.0.0

# Build a beta version from a feature branch
./scripts/build-version.sh beta feature/new-ui

# Build from a specific commit hash
./scripts/build-version.sh 3 abc123def
```

The script will:
- Checkout the specified git reference
- Install dependencies
- Build Amica
- Copy to `builds/amica_v{version}/`
- Create a `.version-info` file with build details
- Return to the main branch

#### Option 2: Building all configured versions

Edit `versions.config.sh` to define your versions:

```bash
AMICA_VERSIONS=(
  "1:main"              # Stable version from main
  "2:v2.0.0"            # Version 2 from tag
  "beta:develop"        # Beta from develop branch
)
```

Then build all versions:

```bash
./scripts/build-all-versions.sh
```

#### Option 3: Manual build

```bash
# Build Amica frontend manually
cd ../amica
git checkout v2.0.0
npm install
npm run build

# Copy to subdomain service
cp -r dist ../subdomain-service/builds/amica_v2/
```

### Deploying version updates

Personas automatically get their specified version:
- Persona with `amica_version: "1"` → gets `builds/amica_v1/`
- Persona with `amica_version: "2"` → gets `builds/amica_v2/`
- Persona with no version set → defaults to `builds/amica_v1/`

## Configuration System

### /config Endpoint

The service provides a `/config` endpoint for each subdomain that returns persona-specific configuration:

**Request:** `GET https://cool-agent.amica.bot/config`

**Response:**
```json
{
  "personaName": "Cool Agent",
  "personaSymbol": "COOL",
  "chainId": 42161,
  "tokenId": "123",
  "domain": "cool-agent",
  "erc20Token": "0x...",
  "creator": "0x...",
  "owner": "0x...",
  "isGraduated": false,
  "metadata": {
    "system_prompt": "You are a helpful AI assistant",
    "vrm_url": "https://example.com/avatar.vrm",
    "bg_color": "#FF5733",
    "chatbot_backend": "openai"
  }
}
```

### How Amica uses the config

1. Amica frontend loads in browser
2. Calls `fetch('/config')` to get persona configuration
3. Applies all metadata values from the config
4. Falls back to defaults for any missing keys

### Valid metadata keys

The service validates metadata keys against `AMICA_CONFIG_KEYS` in `src/amica-config-keys.ts`. This list should be kept in sync with Amica's config system.

**When adding new config keys to Amica:**

1. Update `src/amica-config-keys.ts` in subdomain service:
```typescript
export const AMICA_CONFIG_KEYS = [
  // ... existing keys
  'new_feature_enabled',  // Add new key
] as const;
```

2. Deploy subdomain service
3. Personas can now use the new key in their metadata

### Supported metadata keys

All keys from Amica's config system are supported, including:

**Appearance**:
- `name` - Persona name
- `vrm_url` - 3D avatar model URL
- `bg_url` - Background image URL
- `bg_color` - Background color
- `animation_url` - Animation file URL

**AI Configuration**:
- `system_prompt` - AI personality/instructions
- `chatbot_backend` - AI backend (chatgpt, ollama, etc.)
- `openai_apikey` - OpenAI API key
- `openai_model` - OpenAI model to use
- `openai_url` - OpenAI API URL

**Voice & Speech**:
- `tts_backend` - Text-to-speech backend
- `tts_muted` - Mute TTS
- `stt_backend` - Speech-to-text backend
- `elevenlabs_apikey` - ElevenLabs API key
- `elevenlabs_voiceid` - ElevenLabs voice ID

**Advanced**:
- `wake_word` - Wake word for voice activation
- `wake_word_enabled` - Enable wake word
- `amica_version` - Which Amica build to serve (controls version served from `builds/`)

...and many more! See `src/amica-config-keys.ts` for the complete list.

## Architecture Overview

```
User Browser                Subdomain Service              GraphQL API
     │                             │                           │
     │  GET myagent.amica.bot      │                           │
     ├────────────────────────────>│                           │
     │                             │  Query persona "myagent"  │
     │                             ├──────────────────────────>│
     │                             │<──────────────────────────┤
     │                             │  Returns persona metadata │
     │                             │                           │
     │                             │  Load amica_version=1     │
     │                             │  from builds/amica_v1/    │
     │                             │                           │
     │  Return index.html          │                           │
     │<────────────────────────────┤                           │
     │                             │                           │
     │  GET /config                │                           │
     ├────────────────────────────>│                           │
     │  Return persona config JSON │                           │
     │<────────────────────────────┤                           │
     │                             │                           │
     │  Apply config & render      │                           │
     │                             │                           │
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed VPS + Cloudflare deployment instructions.

## Testing Locally

Use `/etc/hosts` to test subdomains locally:

```
127.0.0.1 test-persona.amica.bot
127.0.0.1 amica.bot
```

Then visit `http://test-persona.amica.bot:3001`

## Development

Type checking:
```bash
npm run typecheck
```

Build:
```bash
npm run build
```

Watch mode for development:
```bash
npm run dev
```
