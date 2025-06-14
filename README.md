# Amica Protocol

> A multi-chain decentralized platform for creating and trading AI persona tokens with automated market making and fair launch mechanics.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.0+-green)](https://openzeppelin.com)

## 🌟 Overview

Amica Protocol revolutionizes AI persona monetization by enabling creators to launch ERC20 tokens representing AI personas. With built-in bonding curves for price discovery and automatic Uniswap integration, the protocol ensures fair launches and sustainable economics across multiple blockchain networks.

### Key Features

- 🚀 **Multi-Chain Support**: Deploy seamlessly across Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche, and BSC
- 🤖 **AI Persona Tokens**: Each persona is an NFT with an associated ERC20 token
- 📈 **Bonding Curves**: Automated price discovery with virtual AMM mechanics
- 🔄 **Auto-Graduation**: Automatic Uniswap pair creation at threshold
- 💰 **Fee Reduction**: AMICA holders enjoy trading fee discounts up to 100%
- 🔥 **Burn Mechanism**: Burn AMICA to claim proportional share of all persona tokens

## 🏗️ Architecture

### Core Contracts

```
AmicaToken.sol          - Main AMICA token with burn-and-claim mechanism
PersonaTokenFactory.sol - Factory for creating personas with bonding curves
ERC20Implementation.sol - Gas-efficient cloneable ERC20 template
AmicaBridgeWrapper.sol  - Enables cross-chain AMICA conversion
```

### Multi-Chain Infrastructure

The protocol uses a hub-and-spoke model:
- **Ethereum Mainnet**: Primary deployment with full AMICA supply
- **L2s/Alt Chains**: Bridge wrappers convert bridged AMICA to native tokens

## 💸 Tokenomics

### AMICA Token
- **Total Supply**: 1,000,000,000 AMICA
- **Initial Distribution**: 100% to contract on Ethereum mainnet
- **Cross-Chain**: Bridged tokens wrapped to native on each chain

### Persona Token Distribution (1B Supply)
```
33.33% (333,333,333) → Deposited to AMICA contract upon graduation
33.33% (333,333,333) → Available on bonding curve for trading
33.34% (333,333,334) → Added to Uniswap liquidity pool
```

### Fee Structure
- **Base Trading Fee**: 1% on bonding curve trades
- **Fee Split**: 50% creator / 50% protocol
- **AMICA Holder Discounts**:
  - 1,000 AMICA = 10% discount
  - 1,000,000 AMICA = 100% discount (fee-free trading)
  - Exponential curve between min/max

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn
- Hardhat

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/amica-protocol
cd amica-protocol

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Configuration

Edit `.env` with your settings:
```env
# Network RPCs
MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
# ... add other networks

# Private Keys
DEPLOYER_PRIVATE_KEY=your_private_key

# Etherscan API Keys (for verification)
ETHERSCAN_API_KEY=your_etherscan_key
ARBISCAN_API_KEY=your_arbiscan_key
# ... add other scanners

# Optional
BRIDGED_AMICA_ADDRESS=0x... # For L2 deployments
```

## 📦 Deployment

### Single Chain Deployment

Deploy to Ethereum mainnet:
```bash
npx hardhat run scripts/deploy-multichain.ts --network mainnet --verify
```

Deploy to L2/Alt chain with bridged AMICA:
```bash
npx hardhat run scripts/deploy-multichain.ts \
  --network arbitrum \
  --bridged-amica 0x123... \
  --verify
```

### Multi-Chain Deployment

Deploy to all supported chains:
```bash
npx hardhat run scripts/deploy-all-chains.ts
```

### Deployment Options

```bash
--bridged-amica <address>  # Bridged AMICA token address (required for non-mainnet)
--verify                   # Verify contracts on block explorer
--gas-price <gwei>        # Override gas price
--gas-limit <amount>      # Override gas limit
```

## 🛠️ Scripts

### Deployment Scripts

| Script | Description |
|--------|-------------|
| `deploy-multichain.ts` | Deploy contracts to any supported chain |
| `deploy-all-chains.ts` | Orchestrate deployment across all chains |
| `deployment-status.ts` | Check deployment status on all chains |
| `verify.ts` | Verify contracts on block explorers |

### Bridge Scripts

| Script | Description |
|--------|-------------|
| `bridge-conversion.ts` | Convert between bridged and native AMICA |
| `--unwrap` flag | Convert native back to bridged AMICA |

### Utility Scripts

| Script | Description |
|--------|-------------|
| `tasks.ts` | Hardhat tasks for common operations |

## 🔄 Cross-Chain Operations

### Bridging AMICA

1. **Bridge from Ethereum**: Use canonical bridge to move AMICA to L2
2. **Wrap on L2**: Convert bridged AMICA to native using bridge wrapper
3. **Use on L2**: Trade, create personas, and earn fee discounts
4. **Unwrap to Bridge Back**: Convert native to bridged for return to Ethereum

### Example: Bridge to Arbitrum

```bash
# After bridging AMICA from Ethereum to Arbitrum...

# Set environment variables
export BRIDGE_WRAPPER_ADDRESS=0x... # From deployment
export BRIDGED_AMICA_ADDRESS=0x...  # Bridged token address
export AMOUNT_TO_CONVERT=1000       # Amount in ether units

# Convert bridged to native
npx hardhat run scripts/bridge-conversion.ts --network arbitrum

# Convert back (for bridging to Ethereum)
npx hardhat run scripts/bridge-conversion.ts --network arbitrum --unwrap
```

## 📊 Monitoring

### Check Deployment Status

```bash
npx hardhat run scripts/deployment-status.ts
```

Output:
```
🌐 AMICA Protocol Deployment Status

📍 Ethereum Mainnet (Chain ID: 1)
   Deployments: 1
   Latest deployment: 2024-03-14T10:30:00Z
   Contracts:
     - AmicaToken: 0x123...
     - PersonaFactory: 0x456...

📍 Arbitrum One (Chain ID: 42161)
   Deployments: 1
   Latest deployment: 2024-03-14T11:00:00Z
   Contracts:
     - AmicaToken: 0x789...
     - PersonaFactory: 0xabc...
     - BridgeWrapper: 0xdef...
```

### Deployment Files

Deployments are saved to `deployments/<chainId>.json`:
```json
{
  "chainId": 42161,
  "chainName": "arbitrum",
  "addresses": {
    "amicaToken": "0x...",
    "personaFactory": "0x...",
    "bridgeWrapper": "0x...",
    "erc20Implementation": "0x..."
  },
  "blockNumber": 123456,
  "timestamp": "2024-03-14T10:30:00Z",
  "deployer": "0x...",
  "transactionHashes": {
    "amicaToken": "0x...",
    "personaFactory": "0x..."
  }
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run with gas reporting
npm run test:gas

# Run specific test file
npx hardhat test test/AmicaToken.test.ts
```

## 🔐 Security

### Features
- ✅ ReentrancyGuard on all external functions
- ✅ Pausable bridge wrapper for emergency situations
- ✅ 100-block snapshot delay prevents flash loan attacks
- ✅ Clone pattern for gas-efficient deployments
- ✅ Comprehensive test coverage
- ✅ OpenZeppelin 5.0+ battle-tested libraries

### Audits
- [ ] Pending professional audit

## 📈 User Flows

### For Creators
1. **Create Persona** → Pay mint cost (1000 AMICA default)
2. **Optional Initial Buy** → Prevent sniping by buying first
3. **Earn Trading Fees** → 50% of all bonding curve trades
4. **Transfer Ownership** → NFT can be sold/transferred

### For Traders
1. **Buy on Curve** → Purchase with increasing price
2. **Wait for Unlock** → 7 days or until graduation
3. **Trade on Uniswap** → After graduation threshold met
4. **Claim Rewards** → Burn AMICA for persona tokens

### For AMICA Holders
1. **Snapshot Balance** → Register holdings for fee discount
2. **Trade with Discount** → Up to 100% fee reduction
3. **Burn for Rewards** → Claim share of all persona tokens
4. **Bridge Cross-Chain** → Use AMICA on any supported network

## 🌐 Supported Networks

| Network | Chain ID | Status | Uniswap | Bridge Support |
|---------|----------|--------|---------|----------------|
| Ethereum | 1 | ✅ Live | V2 | Native |
| Arbitrum | 42161 | ✅ Live | V2 | Canonical Bridge |
| Optimism | 10 | ✅ Live | V2 | Canonical Bridge |
| Polygon | 137 | ✅ Live | V2 | Polygon Bridge |
| Base | 8453 | ✅ Live | V2 | Base Bridge |
| Avalanche | 43114 | ✅ Live | V2 | Avalanche Bridge |
| BSC | 56 | ✅ Live | V2 | Binance Bridge |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md).

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- Website: [heyamica.com](https://heyamica.com)
- Documentation: [docs.heyamica.com](https://docs.heyamica.com)
- Twitter: [@heyamica](https://twitter.com/heyamica)

## ⚠️ Disclaimer

This software is provided "as is", without warranty of any kind. Use at your own risk. Always do your own research and audit smart contracts before interacting with them.
