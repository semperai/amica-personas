# Amica Personas

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Coverage Status](https://coveralls.io/repos/github/semperai/amica-personas/badge.svg?branch=master)](https://coveralls.io/github/semperai/amica-personas?branch=master)

> Launch interactive AI agent tokens with immersive 3D/VR/AR, encrypted messaging, and decentralized compute

**Website**: [personas.heyamica.com](https://personas.heyamica.com)
**Repository**: [github.com/semperai/amica-personas](https://github.com/semperai/amica-personas)

## Overview

Amica Personas is a decentralized platform for launching AI agent tokens on the blockchain. Each persona is a unique AI agent with its own personality, 3D avatar, and ERC-20 token that can be traded on decentralized exchanges.

### Why Personas Matter

Personas make AI agents easier for humans to communicate with. By giving agents distinct personalities and visual identities, we create natural interfaces that are more relatable than faceless APIs. This helps build trust, set clear expectations, and makes AI interactions more human-friendly.

### Key Features

- **AI Persona Tokens**: Launch ERC-20 tokens representing interactive AI agents
- **ENS-Like Domains**: Each persona gets a unique subdomain at .amica.bot (e.g., "assistant.amica.bot")
- **3D Avatars**: VRM format support for immersive 3D/VR/AR experiences
- **AMICA Holder Benefits**: 33% of every persona launched goes to AMICA token holders via Burn & Claim
- **Bonding Curves**: Fair price discovery through automated market making
- **Auto-Graduation**: Automatic Uniswap V3 liquidity pool creation
- **Agent Token Integration**: Optional staking requirements for specialized communities
- **NFT Ownership**: Persona creators receive an NFT with metadata update rights and fee collection

## Repository Structure

This monorepo contains all components of the Amica Personas ecosystem:

```
amica-personas/
├── contracts/         # Smart contracts (Foundry/Solidity)
├── amica/             # 3D AI persona viewer (React/Three.js)
├── website/           # Platform frontend (Next.js)
├── subsquid/          # Multi-chain indexer
└── subdomain-service/ # .amica.bot domain service
```

## Quick Start

### Prerequisites

- Node.js 22+
- npm or yarn
- Foundry (for contracts)
- Docker & Docker Compose (for subsquid)

### Installation

```bash
# Clone the repository
git clone https://github.com/semperai/amica-personas
cd amica-personas

# Initialize submodules
git submodule update --init --recursive
```

### Smart Contracts

```bash
cd contracts

# Install dependencies
forge install

# Compile contracts
forge build

# Run tests
forge test

# Deploy (example: Arbitrum)
forge script script/Deploy.s.sol --rpc-url arbitrum --broadcast
```

### Frontend Website

```bash
cd website

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
# Visit http://localhost:3000
```

### 3D Persona Viewer

```bash
cd amica

# Install dependencies
npm install

# Start development server
npm run dev
# Visit http://localhost:5173
```

### Indexer (Subsquid)

```bash
cd subsquid

# Configure environment
cp .env.example .env
# Edit .env with your RPC endpoints

# Start database
docker-compose up -d

# Run indexer
npm install
npm run build
npm run dev
```

## AMICA Token Utility

Holding AMICA tokens gives you proportional ownership of every persona launched on the platform:

- **33% Distribution**: 33% of each persona's token supply is allocated to AMICA holders
- **Burn & Claim**: Burn AMICA to claim your proportional share of all deposited persona tokens
- **Fee Discounts**: AMICA holders enjoy reduced trading fees (coming soon)
- **Governance**: Participate in protocol governance decisions (coming soon)

This creates continuous value accrual as new personas launch and gain traction.

## Creating Personas

Each persona consists of:

### Basic Information
- **Domain**: Unique subdomain at .amica.bot (like ENS for AI agents)
- **Name**: Display name (3-32 characters)
- **Symbol**: Token ticker (2-8 characters)
- **Description**: Purpose and personality
- **Avatar**: VRM 3D model

### Token Distribution (1B total supply)

**Standard Distribution:**
- 33% - Bonding curve
- 33% - AMICA holders (via Burn & Claim)
- 33% - Uniswap liquidity

**With Agent Token:**
- 33% - Uniswap liquidity
- 33% - AMICA holders (via Burn & Claim)
- 17% - Bonding curve
- 17% - Agent token stakers

### Metadata System

Personas support comprehensive metadata for full customization:
- Visual identity (avatar, backgrounds, themes)
- Personality traits and behavior
- Capabilities and services
- Integration endpoints (Arbius models, APIs)
- Social links and documentation

The NFT owner can update metadata at any time, allowing personas to evolve post-launch.

## Testing

### Contracts
```bash
cd contracts
forge test                    # Run all tests
forge test -vvv              # Verbose output
forge coverage               # Coverage report
```

### Frontend
```bash
cd website
npm test                     # Run tests
npm run lint                 # Lint check
npm run build                # Production build
```

### Amica Viewer
```bash
cd amica
npm test                     # Run tests with Vitest
npm run test -- --coverage   # Coverage report
```

## Contract Addresses

### Arbitrum (Primary Network)
- AMICA Token: `TBD`
- PersonaFactory: `TBD`
- PersonaStaking: `TBD`

*See [contracts/README.md](./contracts/README.md) for full deployment details*

## Contributing

We welcome contributions! To contribute:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Documentation

- [Getting Started](https://personas.heyamica.com/docs/getting-started) - Connect wallet and create your first persona
- [Creating Personas](https://personas.heyamica.com/docs/creating-personas) - Detailed creation guide
- [Burn & Claim](https://personas.heyamica.com/docs/burn-and-claim) - How to claim persona tokens
- [Smart Contracts](./contracts/README.md) - Contract architecture
- [Frontend](./website/README.md) - dApp development
- [Full Documentation](https://personas.heyamica.com/docs) - Complete protocol docs

## Links

- Website: [personas.heyamica.com](https://personas.heyamica.com)
- Documentation: [personas.heyamica.com/docs](https://personas.heyamica.com/docs)
- Twitter: [@heyamica](https://twitter.com/heyamica)
- Telegram: [t.me/arbius_ai](https://t.me/arbius_ai)
- Repository: [github.com/semperai/amica-personas](https://github.com/semperai/amica-personas)

## Disclaimer

This software is provided "as is", without warranty of any kind. Use at your own risk. Always do your own research and audit smart contracts before interacting with them.

## License

MIT License - see [LICENSE](LICENSE) for details

---

*Built with ❤️ by the Amica team*
