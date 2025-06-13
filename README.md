# Amica Protocol

A decentralized platform for creating and trading AI persona tokens with automated market making and fair launch mechanics.

## Overview

Amica Protocol enables creators to launch ERC20 tokens representing AI personas, with built-in bonding curves for price discovery and automatic Uniswap integration upon reaching graduation thresholds.

## Core Components

### 1. **AmicaToken (AMICA)**
- Total Supply: 1,000,000,000 AMICA
- Burn-and-claim mechanism: Burn AMICA to receive proportional share of deposited persona tokens
- Governs the ecosystem and captures value from all persona tokens

### 2. **PersonaTokenFactory**
- Creates persona NFTs with associated ERC20 tokens
- Implements bonding curve for initial price discovery
- Automatically creates Uniswap pairs upon graduation

## Tokenomics

### Persona Token Distribution (33/33/33 Split)
Each persona token has 1 billion supply distributed as:
- **33.33%** (333,333,333): Deposited to AMICA contract upon graduation
- **33.33%** (333,333,333): Available on bonding curve
- **33.34%** (333,333,334): Added to Uniswap liquidity upon graduation

### Trading Fees
- Default: 1% on all bonding curve trades
- Split: 50% to creator, 50% to protocol
- Fee reduction: Hold AMICA to reduce fees (up to 100% discount)

### Fee Reduction Mechanism
Users holding AMICA tokens receive trading fee discounts:
- Minimum: 1,000 AMICA = 10% discount
- Maximum: 1,000,000 AMICA = 100% discount (no fees)
- Uses exponential curve for progression
- Requires 100-block snapshot delay to prevent gaming

## User Flow

### For Creators
1. **Create Persona**: Pay mint cost in pairing token (AMICA, USDC, WETH, etc.)
2. **Optional Initial Buy**: Purchase tokens at launch to prevent sniping
3. **Earn Fees**: Receive 50% of trading fees as NFT owner
4. **Transfer Ownership**: NFT (and fee rights) can be traded

### For Traders
1. **Buy on Bonding Curve**: Purchase tokens with increasing price
2. **Tokens Locked**: Cannot withdraw until graduation or 7 days
3. **Graduation**: Automatic Uniswap pair creation at threshold
4. **Withdraw**: Claim tokens after graduation

### For AMICA Holders
1. **Stake for Discounts**: Snapshot AMICA balance for fee reduction
2. **Burn for Rewards**: Burn AMICA to claim deposited persona tokens
3. **Governance**: (Future) Participate in protocol decisions

## Technical Features

### Bonding Curve
- Virtual AMM with 100,000 AMICA : 33,333,333 persona token reserves
- Price increases exponentially as supply decreases
- 1% protocol fee on output (separate from trading fees)

### Graduation Mechanism
When total deposits reach the threshold:
1. 333,333,333 tokens deposited to AMICA contract
2. All pairing tokens + 333,333,334 persona tokens added to Uniswap
3. Bonding curve disabled, trading moves to Uniswap
4. All locked tokens become withdrawable

### Pairing Flexibility
- Default: AMICA pairing with 1,000 AMICA mint cost
- Custom pairings: USDC, WETH, or any ERC20
- Each pairing has configurable mint cost and graduation threshold

### Security Features
- Reentrancy protection on all external functions
- Clone pattern for gas-efficient token deployment
- Upgradeable proxy for factory contract
- Slippage protection and deadlines on swaps

## Smart Contract Architecture

### Contracts
- `AmicaToken.sol`: Main AMICA token with burn mechanism
- `PersonaTokenFactory.sol`: Factory for creating personas
- `ERC20Implementation.sol`: Cloneable ERC20 template

### Key Functions

#### PersonaTokenFactory
- `createPersona()`: Launch new persona with NFT and token
- `swapExactTokensForTokens()`: Buy on bonding curve
- `withdrawTokens()`: Claim unlocked tokens
- `updateAmicaSnapshot()`: Register AMICA balance for discounts

#### AmicaToken
- `burnAndClaim()`: Burn AMICA for persona tokens
- `deposit()`: Used by personas to deposit tokens
- `withdraw()`: Owner function to distribute AMICA

## Economic Model

### Value Accrual to AMICA
1. **Direct Deposits**: 33.33% of each persona token supply
2. **Trading Volume**: 50% of all trading fees
3. **Burn Mechanism**: Deflationary pressure from claims

### Incentive Alignment
- **Creators**: Earn from trading fees, incentivized to build community
- **Early Buyers**: Get better prices but accept 7-day lock
- **AMICA Holders**: Reduce fees and claim persona tokens
- **Protocol**: Sustainable revenue from fees and deposits

## Installation

```bash
npm install
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run with gas reporting
npm run test:gas
```

## Deployment

1. Copy `env.example` to `.env` and fill in your values
2. Run deployment script:

```bash
# Deploy to local hardhat network
npm run node
npm run deploy:local

# Deploy to mainnet/testnet
npx hardhat run scripts/deploy.ts --network <network-name>
```

## Contract Addresses

See deployment output for contract addresses.

## Security

- All contracts use OpenZeppelin 5.0+ libraries
- ReentrancyGuard on critical functions
- Comprehensive test coverage

## License

MIT
