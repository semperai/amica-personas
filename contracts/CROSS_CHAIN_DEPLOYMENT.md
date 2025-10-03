# AMICA Cross-Chain Deployment Guide

## Overview

AMICA token is deployed across three chains with the same contract address using CREATE2:

- **Ethereum Mainnet**: `AmicaTokenMainnet` - Source token with burn-and-claim functionality
- **Arbitrum One**: `AmicaTokenBridged` - L2 token with deposit-and-mint functionality
- **Base**: `AmicaTokenBridged` - L2 token with deposit-and-mint functionality

**Max Supply**: 1 billion AMICA tokens (total across all chains)

## Architecture

### Ethereum Mainnet (AmicaTokenMainnet)
- Full 1 billion supply minted at deployment
- Burn-and-claim functionality (users burn AMICA to claim proportional share of tokens)
- Upgradeable (UUPS proxy pattern)
- Pausable for emergency situations
- Acts as the canonical AMICA token

### Arbitrum One & Base (AmicaTokenBridged)
- Zero initial supply
- Owner configures deposit tokens (e.g., USDC, USDT, DAI)
- Users deposit configured tokens to mint AMICA
- Exchange rates set by owner
- Max supply enforced (cannot exceed 1 billion total)
- Upgradeable (UUPS proxy pattern)
- Pausable for emergency situations

## Deployment

### Prerequisites

```bash
# Set environment variables in .env
PRIVATE_KEY=your_private_key
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_key
ARBISCAN_API_KEY=your_arbiscan_key
BASESCAN_API_KEY=your_basescan_key
```

### Step 1: Deploy to Ethereum Mainnet

```bash
# Deploy AmicaTokenMainnet
forge script script/DeployAmicaMainnet.s.sol:DeployAmicaMainnet \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify
```

This deploys the mainnet AMICA token with 1 billion supply.

### Step 2: Deploy to Arbitrum One

```bash
# Deploy AmicaTokenBridged on Arbitrum
forge script script/DeployAmicaBridged.s.sol:DeployAmicaBridged \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast \
  --verify
```

### Step 3: Deploy to Base

```bash
# Deploy AmicaTokenBridged on Base
forge script script/DeployAmicaBridged.s.sol:DeployAmicaBridged \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify
```

### Step 4: Configure Deposit Tokens (Arbitrum & Base)

After deploying to L2s, configure which tokens can be deposited to mint AMICA:

```bash
# Example: Configure USDC on Arbitrum One
# USDC has 6 decimals, exchange rate 1:1 (1e18 = 1 AMICA per 1 USDC)
forge script script/DeployAmicaBridged.s.sol:DeployAmicaBridged \
  --sig "configureDepositToken(address,address,bool,uint256,uint8)" \
  <AMICA_PROXY_ADDRESS> \
  <USDC_ADDRESS> \
  true \
  1000000000000000000 \
  6 \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast

# Example: Configure USDT on Base
forge script script/DeployAmicaBridged.s.sol:DeployAmicaBridged \
  --sig "configureDepositToken(address,address,bool,uint256,uint8)" \
  <AMICA_PROXY_ADDRESS> \
  <USDT_ADDRESS> \
  true \
  1000000000000000000 \
  6 \
  --rpc-url $BASE_RPC_URL \
  --broadcast
```

## Token Addresses

### Arbitrum One
- USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- USDT: `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`
- DAI: `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1`

### Base
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- USDbC: `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`

## Usage

### Ethereum Mainnet: Burn and Claim

Users can burn AMICA to claim proportional shares of any tokens held by the contract:

```solidity
// Approve AMICA spending
amica.approve(amicaAddress, amountToBurn);

// Burn and claim (example: claiming USDC and DAI)
address[] memory tokens = new address[](2);
tokens[0] = USDC_ADDRESS; // Must be sorted ascending
tokens[1] = DAI_ADDRESS;

amica.burnAndClaim(amountToBurn, tokens);
```

### Arbitrum/Base: Deposit and Mint

Users deposit configured tokens to mint AMICA:

```solidity
// Check if token is supported
(bool enabled, uint256 rate, uint8 decimals) = amica.tokenConfigs(USDC_ADDRESS);

// Preview how much AMICA you'll receive
uint256 amountToMint = amica.previewDepositAndMint(USDC_ADDRESS, 100e6); // 100 USDC

// Approve USDC spending
IERC20(USDC_ADDRESS).approve(amicaAddress, 100e6);

// Deposit and mint
amica.depositAndMint(USDC_ADDRESS, 100e6);
```

### Admin Functions

#### Configure Deposit Token (L2 only)
```solidity
// Enable USDC with 1:1 exchange rate
amica.configureToken(
    USDC_ADDRESS,   // token address
    true,           // enabled
    1e18,           // 1 AMICA per 1 USDC (18 decimals)
    6               // USDC has 6 decimals
);

// Disable a token
amica.configureToken(USDC_ADDRESS, false, 0, 6);
```

#### Withdraw Accumulated Tokens (L2 only)
```solidity
// Withdraw USDC accumulated from deposits
amica.withdrawToken(USDC_ADDRESS, recipientAddress, amount);
```

#### Pause/Unpause
```solidity
// Pause all transfers and minting
amica.pause();

// Resume operations
amica.unpause();
```

## Exchange Rate Examples

Exchange rates are specified as "amount of AMICA (18 decimals) per 1 unit of deposit token":

| Scenario | Deposit Token | Decimals | Exchange Rate | Result |
|----------|---------------|----------|---------------|---------|
| 1:1 ratio | USDC | 6 | 1e18 | 1 USDC → 1 AMICA |
| 1:2 ratio | USDC | 6 | 2e18 | 1 USDC → 2 AMICA |
| 1:0.5 ratio | USDC | 6 | 0.5e18 | 1 USDC → 0.5 AMICA |
| 1:1 ratio | DAI | 18 | 1e18 | 1 DAI → 1 AMICA |

## Security Considerations

1. **Max Supply Enforcement**: Both contracts enforce 1 billion max supply
2. **Pausable**: Owner can pause in emergencies
3. **Upgradeable**: Contracts can be upgraded via UUPS proxy pattern
4. **Reentrancy Protection**: All state-changing functions are protected
5. **Safe Token Transfers**: Uses OpenZeppelin's SafeERC20

## Verification

After deployment, verify contracts on block explorers:

```bash
# Verify on Etherscan
forge verify-contract <ADDRESS> AmicaTokenMainnet --chain mainnet

# Verify on Arbiscan
forge verify-contract <ADDRESS> AmicaTokenBridged --chain arbitrum

# Verify on Basescan
forge verify-contract <ADDRESS> AmicaTokenBridged --chain base
```

## Monitoring

Key metrics to monitor:

1. **Total Supply**: Should never exceed 1 billion across all chains
2. **Deposit Token Balances**: Track accumulated deposits on L2s
3. **Exchange Rates**: Ensure rates are appropriate for market conditions
4. **Pause Status**: Monitor for any emergency pauses

## Upgrading Contracts

Both contracts use UUPS upgradeable pattern:

```bash
# Upgrade AmicaTokenMainnet
forge script script/UpgradeAmicaToken.s.sol:UpgradeAmicaToken \
  --sig "upgradeMainnet(address)" <PROXY_ADDRESS> \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast

# Upgrade AmicaTokenBridged on Arbitrum
forge script script/UpgradeAmicaToken.s.sol:UpgradeAmicaToken \
  --sig "upgradeBridged(address)" <PROXY_ADDRESS> \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast
```

## Testing

Run tests to verify functionality:

```bash
# Test mainnet functionality
forge test --match-path test/AmicaTokenMainnet.t.sol

# Test bridged functionality
forge test --match-path test/AmicaTokenBridged.t.sol

# Test cross-chain supply constraints
forge test --match-path test/CrossChainSupply.t.sol
```

## Support

For issues or questions:
- GitHub: https://github.com/holic/amica-protocol
- Email: kasumi-null@yandex.com
