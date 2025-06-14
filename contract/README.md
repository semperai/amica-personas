# Amica Protocol

> A multi-chain decentralized platform for creating and trading AI persona tokens with agent token integration, automated market making, and fair launch mechanics.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.3+-green)](https://openzeppelin.com)

## 🌟 Overview

Amica Protocol revolutionizes AI persona monetization by enabling creators to launch ERC20 tokens representing AI personas. With built-in bonding curves for price discovery, automatic Uniswap integration, and optional agent token pairing, the protocol ensures fair launches and sustainable economics across multiple blockchain networks.

### Key Features

- 🚀 **Multi-Chain Support**: Deploy seamlessly across Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche, and BSC
- 🤖 **AI Persona Tokens**: Each persona is an NFT (ERC721) with an associated ERC20 token
- 📈 **Bonding Curves**: Bancor-style automated price discovery with virtual reserves
- 🔄 **Auto-Graduation**: Automatic Uniswap V2 pair creation at configurable threshold
- 💰 **Fee Reduction**: AMICA holders enjoy trading fee discounts up to 100% based on snapshot balance
- 🔥 **Burn Mechanism**: Burn AMICA to claim proportional share of deposited tokens
- 🤝 **Agent Token Integration**: Optional pairing with approved agent tokens for enhanced rewards
- 🌾 **Staking Rewards**: MasterChef-style staking for LP providers with boosted rewards for agent pools

## 🏗️ Architecture

### Core Contracts

```
AmicaToken.sol               - Main AMICA token with burn-and-claim mechanism
PersonaTokenFactory.sol      - Upgradeable factory for creating personas with bonding curves
PersonaStakingFactory.sol    - Staking rewards contract for LP providers
ERC20Implementation.sol      - Gas-efficient cloneable ERC20 template
AmicaBridgeWrapper.sol       - Enables cross-chain AMICA conversion
```

### Multi-Chain Infrastructure

The protocol uses a hub-and-spoke model:
- **Ethereum Mainnet**: Primary deployment with full AMICA supply (1B tokens)
- **L2s/Alt Chains**: Bridge wrappers convert bridged AMICA to native tokens

## 💸 Tokenomics

### AMICA Token
- **Total Supply**: 1,000,000,000 AMICA
- **Initial Distribution**: 100% minted to contract on Ethereum mainnet (chainId: 1)
- **Cross-Chain**: Bridged tokens wrapped to native on each chain via AmicaBridgeWrapper

### Persona Token Distribution

Each persona token has 1,000,000,000 (1B) supply distributed as follows:

#### Without Agent Token (33.33% each)
- **333,333,333** → Liquidity pool on Uniswap
- **333,333,333** → Available on bonding curve
- **333,333,334** → Deposited to AMICA contract

#### With Agent Token (Different distribution)
- **333,333,333** (1/3) → Liquidity pool on Uniswap
- **222,222,222** (2/9) → Available on bonding curve
- **222,222,222** (2/9) → Deposited to AMICA contract
- **222,222,223** (2/9) → Rewards for agent token depositors

### Fee Structure
- **Base Trading Fee**: 1% on bonding curve trades (configurable)
- **Fee Split**: 50% creator / 50% protocol (configurable)
- **AMICA Holder Discounts** (Exponential curve):
  - 1,000 AMICA = 10% discount (0.9% fee)
  - 1,000,000 AMICA = 100% discount (0% fee)
  - Requires 100-block snapshot delay for anti-flash loan protection

### Staking Rewards
- **LP Staking**: Stake Persona/PairingToken or Persona/AgentToken LP tokens
- **Agent Pool Boost**: 1.5x rewards multiplier for agent token pools
- **Reward Distribution**: Configurable AMICA per block across pools

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

## 📦 Smart Contract Features

### PersonaTokenFactory

#### Creating a Persona
```solidity
function createPersona(
    address pairingToken,        // Token to pair with (e.g., AMICA)
    string memory name,          // Persona name
    string memory symbol,        // Token symbol
    string[] memory metadataKeys,
    string[] memory metadataValues,
    uint256 initialBuyAmount,    // Optional initial purchase
    address agentToken,          // Optional agent token (0x0 if none)
    uint256 minAgentTokens       // Min agent tokens for graduation
) external returns (uint256 tokenId)
```

#### Key Parameters
- **Mint Cost**: 1000 AMICA (default, configurable per pairing token)
- **Graduation Threshold**: 1,000,000 pairing tokens deposited
- **Lock Period**: Tokens locked until graduation (pair creation)

### AmicaToken

#### Burn and Claim Mechanism
```solidity
function burnAndClaim(
    uint256 amountToBurn,
    uint256[] calldata tokenIndexes  // Which deposited tokens to claim
) external
```

Burns AMICA to receive proportional share of all deposited tokens based on:
```
userShare = amountToBurn / circulatingSupply
claimAmount = depositedBalance * userShare
```

### Agent Token Integration

1. **Deposit Phase**: Users can deposit approved agent tokens before graduation
2. **Withdrawal**: Can withdraw before graduation or claim rewards after
3. **Reward Distribution**: Pro-rata share of persona tokens based on deposits

## 🔄 User Flows

### For Creators
1. **Create Persona** → Pay mint cost in pairing token
2. **Optional Agent Token** → Associate approved agent token for enhanced rewards
3. **Set Metadata** → Add custom key-value metadata to persona
4. **Earn Trading Fees** → Receive 50% of bonding curve trading fees
5. **Transfer Ownership** → Persona NFT is transferable

### For Traders
1. **Buy on Bonding Curve** → Purchase with increasing price (Bancor formula)
2. **Pay Fees** → 1% fee (reduced based on AMICA holdings)
3. **Wait for Graduation** → Tokens locked until Uniswap pair created
4. **Trade on Uniswap** → After graduation threshold met
5. **Withdraw Tokens** → Claim unlocked tokens after graduation

### For AMICA Holders
1. **Snapshot Balance** → Call `updateAmicaSnapshot()` to register holdings
2. **Wait 100 Blocks** → Anti-flash loan protection
3. **Trade with Discount** → Automatic fee reduction on all trades
4. **Burn for Rewards** → Burn AMICA to claim share of all deposited tokens
5. **Bridge Cross-Chain** → Use bridge wrapper to convert tokens

### For Agent Token Holders
1. **Deposit Agent Tokens** → During bonding phase only
2. **Wait for Graduation** → Cannot withdraw after graduation
3. **Claim Persona Rewards** → Receive pro-rata share of persona tokens
4. **Stake LP Tokens** → Get 1.5x boosted staking rewards

## 🌾 Staking System

### Pool Types
1. **Standard Pools**: Persona/PairingToken LP tokens
2. **Agent Pools**: Persona/AgentToken LP tokens (1.5x rewards boost)

### Staking Operations
- `stake(poolId, amount)` - Stake LP tokens
- `withdraw(poolId, amount)` - Withdraw LP tokens
- `claim(poolId)` - Claim pending rewards
- `claimAll(poolIds)` - Claim from multiple pools

## 🛡️ Security Features

### Snapshot System
- **100-block delay**: Prevents flash loan attacks on fee discounts
- **Minimum balance**: Must hold at least 1,000 AMICA
- **Automatic updates**: System checks for pending snapshots on trades

### Access Control
- **Ownable**: Admin functions protected
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Pausable**: Emergency pause functionality on bridge wrapper

### Trading Safeguards
- **Slippage protection**: `amountOutMin` parameter on swaps
- **Deadline checks**: Transactions expire if not executed in time
- **Graduation requirements**: Optional minimum agent token deposits

## 📊 Bonding Curve Mathematics

The protocol uses a Bancor-inspired formula with virtual reserves:

```
Virtual AMICA Reserve = 100,000 AMICA
Virtual Token Reserve = Total Supply / 10

k = currentTokenReserve * currentAmicaReserve
newAmicaReserve = currentAmicaReserve + amountIn
newTokenReserve = k / newAmicaReserve
amountOut = (currentTokenReserve - newTokenReserve) * 0.99
```

This creates a smooth price curve that starts low and increases with demand.

## 🌐 Supported Networks

| Network | Chain ID | Status | Notes |
|---------|----------|--------|-------|
| Ethereum | 1 | ✅ Primary | Full AMICA supply minted here |
| Arbitrum | 42161 | ✅ Supported | Use bridge wrapper |
| Optimism | 10 | ✅ Supported | Use bridge wrapper |
| Polygon | 137 | ✅ Supported | Use bridge wrapper |
| Base | 8453 | ✅ Supported | Use bridge wrapper |
| Avalanche | 43114 | ✅ Supported | Use bridge wrapper |
| BSC | 56 | ✅ Supported | Use bridge wrapper |

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
