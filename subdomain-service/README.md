# Amica Subdomain Service

A TypeScript service that dynamically serves Amica persona frontends based on subdomain lookups.

## How it works

1. User visits `cool-agent.amica.bot`
2. Server parses subdomain (`cool-agent`)
3. Queries GraphQL API for persona with domain `cool-agent` on Arbitrum One
4. Loads persona metadata (name, system_prompt, vrm_url, etc.)
5. Checks `amica_version` metadata (defaults to `1`)
6. Serves the appropriate Amica build from `builds/amica_v{version}/`
7. Injects persona config via localStorage before app loads

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

Build the Amica frontend and copy to `builds/`:

```bash
# Use the build script
./scripts/build-amica-version.sh 1
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
│   ├── setup.sh               # Initial setup
│   └── build-amica-version.sh # Build Amica versions
├── builds/
│   ├── amica_v1/              # Amica version 1 build
│   └── amica_v2/              # Future versions
├── package.json
├── tsconfig.json
├── jest.config.js
└── .env
```

## Metadata Injection

The service **dynamically** injects any metadata that matches valid Amica config keys. This means:

1. **No server updates needed**: When new config keys are added to Amica, just update `amica-config-keys.ts` with the new keys
2. **All keys supported**: Every key in Amica's config system is automatically supported
3. **Backward compatible**: Old personas continue to work with their existing metadata

### How it works

The service:
1. Reads all metadata from the persona NFT
2. Checks each metadata key against `AMICA_CONFIG_KEYS`
3. If valid, injects it as `localStorage.setItem('chatvrm_{key}', value)`
4. Persona name is always injected as `chatvrm_name`

### Adding new config keys

When Amica adds new configuration options:

1. Update `src/amica-config-keys.ts`:
```typescript
export const AMICA_CONFIG_KEYS = [
  // ... existing keys
  'new_feature_enabled',  // Add new key here
] as const;
```

2. That's it! The server will automatically inject this metadata for all personas.

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
- `voice_url` - Voice model URL
- `tts_backend` - Text-to-speech backend
- `tts_muted` - Mute TTS
- `stt_backend` - Speech-to-text backend
- `elevenlabs_apikey` - ElevenLabs API key
- `elevenlabs_voiceid` - ElevenLabs voice ID

**Advanced**:
- `wake_word` - Wake word for voice activation
- `wake_word_enabled` - Enable wake word
- `language` - Interface language
- `amica_version` - Which Amica build to serve

...and many more! See `src/amica-config-keys.ts` for the complete list.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed VPS + Cloudflare deployment instructions.

## Adding New Amica Versions

When you upgrade Amica:

1. Build the new version:
```bash
./scripts/build-amica-version.sh 2
```

2. Users set `amica_version=2` in their persona metadata
3. Service automatically serves the new version for those personas

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
