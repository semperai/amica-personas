# Amica Protocol

A decentralized protocol for creating persona NFTs with associated ERC20 tokens and a burn-to-claim distribution mechanism.

## Features

- **AmicaToken**: Main protocol token with burn-and-claim mechanism
- **PersonaTokenFactory**: Create NFTs with associated ERC20 tokens
- **Bonding Curve**: Fair launch mechanism for persona tokens
- **Liquidity Graduation**: Automatic Uniswap pair creation

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
- Audited by [Audit Firm Name]

## License

MIT
