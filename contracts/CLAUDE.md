# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amica Protocol is a Foundry-based smart contract system for creating and managing persona tokens with bonding curves and Uniswap V4 integration. The protocol implements:

- **PersonaTokenFactory**: Main factory contract (ERC721-based) for creating and managing persona tokens
- **Bonding Curve Mechanism**: Virtual reserves AMM (x*y=k) with 133x price multiplier at graduation
- **Uniswap V4 Integration**: Automated liquidity pool creation after bonding curve graduation
- **Dynamic Fee System**: Fee reduction based on AMICA token holdings via Uniswap V4 hooks
- **Upgradeable Architecture**: Uses OpenZeppelin's upgradeable proxy pattern

## Development Commands

### Build and Test
```bash
# Build contracts
forge build

# Run all tests
forge test

# Run specific test file
forge test --match-path test/PersonaTokenFactory.creation.t.sol

# Run tests with gas reporting
forge test --gas-report

# Format code
forge fmt

# Generate gas snapshots
forge snapshot
```

### Local Development
```bash
# Start local fork of Base mainnet
anvil --fork-url $BASE_RPC_URL

# Deploy to local fork
forge script script/DeployAmicaProtocol.s.sol:DeployAmicaProtocol \
  --rpc-url http://localhost:8545 \
  --broadcast

# Configure pairing tokens after deployment
forge script script/DeployUtils.s.sol:DeployUtils \
  --sig "configurePairingTokens()" \
  --rpc-url http://localhost:8545 \
  --broadcast
```

### Deployment
```bash
# Deploy to Base mainnet
forge script script/DeployAmicaProtocol.s.sol:DeployAmicaProtocol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

# Check deployment
forge script script/DeployUtils.s.sol:DeployUtils \
  --sig "checkDeployment()" \
  --rpc-url $BASE_RPC_URL
```

### Upgrading Contracts
```bash
# Upgrade AmicaToken (ContractType = 0)
forge script script/UpgradeAmicaProtocol.s.sol:UpgradeAmicaProtocol \
  --sig "upgradeContract(uint8)" 0 \
  --rpc-url $BASE_RPC_URL \
  --broadcast

# Upgrade PersonaFactory (ContractType = 1)
forge script script/UpgradeAmicaProtocol.s.sol:UpgradeAmicaProtocol \
  --sig "upgradeContract(uint8)" 1 \
  --rpc-url $BASE_RPC_URL \
  --broadcast
```

## Architecture

### Core Contracts (`src/`)

**PersonaTokenFactory.sol** - Central factory contract that:
- Manages persona token creation and lifecycle
- Implements bonding curve trading (buy/sell)
- Handles graduation to Uniswap V4 when 85% of bonding tokens are sold
- Manages token distribution: 1/3 bonding curve, 1/6 creator, 1/6 protocol, 1/3 Uniswap liquidity
- Uses consolidated error codes (Invalid, Insufficient, Failed, NotAllowed)

**BondingCurve.sol** - Pure math library for:
- Constant product AMM formula (x*y=k)
- Virtual reserves calculation
- Buy/sell price computation
- 0.1% sell fee to prevent manipulation

**DynamicFeeHook.sol** - Uniswap V4 hook that:
- Provides dynamic fee reduction based on AMICA holdings
- Integrates with FeeReductionSystem for fee calculations
- Implements beforeSwap hook to apply custom fees per user

**FeeReductionSystem.sol** - Fee management system:
- Tracks user AMICA token snapshots with 100-block delay
- Calculates dynamic fees (30 bps base, 10 bps max discount)
- Prevents flash loan attacks via snapshot mechanism

**AmicaToken.sol** - Protocol governance token (ERC20, upgradeable)

**PersonaToken.sol** - Individual persona tokens (ERC20, minimal cloneable implementation)

### Test Organization (`test/`)

Tests are split by functionality:
- `PersonaTokenFactory.*.t.sol` - Factory tests split by feature (creation, graduation, fees, admin, etc.)
- `BondingCurveTest*.t.sol` - Bonding curve math and security tests
- `FeeReductionSystem.t.sol` - Fee reduction logic tests
- `shared/` - Test helpers (Deployers.sol, Fixtures.sol)

### Scripts (`script/`)

- `DeployAmicaProtocol.s.sol` - Main deployment script with upgradeable proxies
- `DeployConfig.s.sol` - Network-specific configuration
- `DeployUtils.s.sol` - Post-deployment utilities (configure pairing tokens, check deployment)
- `UpgradeAmicaProtocol.s.sol` - Contract upgrade scripts

## Key Technical Details

### Token Economics
- Total supply per persona: 1 billion tokens (1e9 * 1e18)
- Distribution: THIRD_SUPPLY (333.33M), SIXTH_SUPPLY (166.66M)
- Graduation threshold: 85% of bonding curve tokens sold
- Bonding curve multiplier: 133x price increase at graduation

### Uniswap V4 Integration
- Tick spacing: 60
- Full range liquidity: ticks -887220 to 887220
- Uses PositionManager for liquidity operations
- Hook integration for dynamic fees

### Security Features
- Reentrancy guards on all state-changing functions
- Pausable functionality for emergency stops
- Permit2 integration for gasless approvals
- Consolidated error system for gas efficiency
- Virtual reserves prevent price manipulation

### Upgrade Pattern
- Uses OpenZeppelin's upgradeable contracts with UUPS pattern
- Proxy admin managed separately
- Storage gaps for future upgrades (`__gap[50]`)

## Environment Setup

Required `.env` variables:
```
PRIVATE_KEY=your_private_key_here
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_key
```

## Import Remappings

Key remappings (see `remappings.txt`):
- `@uniswap/v4-core/` → Uniswap V4 core contracts
- `@uniswap/v4-periphery/` → Uniswap V4 periphery contracts
- `@openzeppelin/contracts-upgradeable/` → OpenZeppelin upgradeable contracts
- `forge-std/` → Forge standard library for testing
