# Amica Base Network Indexer

A Subsquid indexer for the Amica protocol on Base network.

## Features

- **Complete Event Coverage:** Indexes 22/22 critical events (100%)
- **Persona NFTs:** Creation, transfers, metadata updates
- **Bonding Curve:** All buys and sells with fee tracking
- **Uniswap V4:** Pool creation, graduations, fee collection
- **AMICA Token Transfers:** ALL token movements with smart contract context
- **Agent Tokens:** Deposits, withdrawals, reward distribution
- **Staking:** Flexible and locked staking, reward claims
- **Bridge:** Wrap/unwrap, emergency withdrawals, metrics
- **Statistics:** Global and daily aggregations
- **Burn & Claim:** Token claiming mechanism tracking

## Prerequisites

- Node.js v18 or higher
- Docker and Docker Compose
- PostgreSQL (via Docker)

## Setup

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the database:**
```bash
docker compose up -d
```

4. **Generate TypeORM models from schema:**
```bash
npm run codegen
```

5. **Generate TypeScript types from ABIs:**
```bash
npm run typegen
```

6. **Run database migrations:**
```bash
npm run db:migrate
```

7. **Build the project:**
```bash
npm run build
```

8. **Start the processor:**
```bash
npm run processor:start
```

9. **In a separate terminal, start the GraphQL server:**
```bash
npm run serve
```

The GraphQL playground will be available at http://localhost:4000/graphql

## Project Structure

```
src/
├── abi/                 # Contract ABIs
├── handlers/           # Event handler modules
│   ├── agent.ts       # Agent token events
│   ├── bridge.ts      # Bridge events
│   ├── fees.ts        # Fee configuration events
│   ├── liquidity.ts   # Liquidity events
│   ├── metadata.ts    # Metadata events
│   ├── persona.ts     # Persona creation events
│   ├── staking.ts     # Staking events
│   ├── stats.ts       # Statistics aggregation
│   └── trading.ts     # Trading events
├── model/             # Generated TypeORM entities
├── main.ts           # Main processor logic
└── processor.ts      # Processor configuration
```

## Key Entities

### Persona
- Core NFT representing an AI agent
- Tracks token info, trading stats, and graduation status

### Trade
- Individual trades on the bonding curve
- Includes fee calculations

### StakingPool
- Staking pool configuration
- Tracks total staked and reward distribution

### UserStake
- User's position in a staking pool
- Supports both flexible and locked staking

### BridgeActivity
- Records AMICA token wrapping/unwrapping

## Example Queries

### Get all personas with their stats:
```graphql
query {
  personas(orderBy: createdAt_DESC) {
    id
    name
    symbol
    erc20Token
    totalDeposited
    tokensSold
    pairCreated
    trades {
      id
      amountIn
      amountOut
      timestamp
    }
  }
}
```

### Get staking pools and user positions:
```graphql
query {
  stakingPools {
    id
    lpToken
    totalStaked
    isActive
    userStakes {
      user
      flexibleAmount
      lockedAmount
    }
  }
}
```

### Get daily statistics:
```graphql
query {
  dailyStats(orderBy: date_DESC, limit: 7) {
    date
    newPersonas
    trades
    volume
    uniqueTraders
    bridgeVolume
  }
}
```

## Troubleshooting

### Database connection issues
- Ensure PostgreSQL is running: `docker compose ps`
- Check connection settings in `.env`

### Missing events
- Verify the start block in `src/processor.ts`
- Check RPC endpoint is working

### Type errors
- Regenerate types: `npm run codegen && npm run typegen`
- Rebuild: `npm run build`

## Development

### Adding new events:
1. Add event topic to processor configuration
2. Create handler function in appropriate handler module
3. Update main.ts to call the handler
4. Add any new entities to schema.graphql
5. Regenerate models: `npm run codegen`

### Testing Locally

For comprehensive local testing, see [TESTING.md](./TESTING.md).

Quick commands:
```bash
# Start database and prepare for indexing
./test-local.sh start

# Run processor in test mode
npm run test:local

# Validate that indexing is working
npm run test:validate

# Start full stack (db + processor + graphql)
./test-local.sh full

# Test GraphQL queries
./test-local.sh query

# Reset database
./test-local.sh reset
```

### Updating Contract ABIs

When contracts are updated:
```bash
# 1. Build contracts (from contracts directory)
cd ../contracts && forge build

# 2. Copy new ABIs to subsquid
cd ../subsquid
cp ../contracts/out/PersonaTokenFactory.sol/PersonaTokenFactory.json src/abi/
cp ../contracts/out/AmicaToken.sol/AmicaToken.json src/abi/
cp ../contracts/out/AmicaBridgeWrapper.sol/AmicaBridgeWrapper.json src/abi/

# 3. Regenerate TypeScript types
npm run typegen

# 4. Update handlers as needed for new/changed events

# 5. Rebuild
npm run build
```

## Deployment

For production deployment on Subsquid Cloud:
1. Update `squid.yaml` with your squid name
2. Install Subsquid CLI: `npm i -g @subsquid/cli`
3. Deploy: `sqd deploy`

## License

MIT
