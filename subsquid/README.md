# Amica Base Network Indexer

A Subsquid indexer for the Amica protocol on Base network.

## Features

- Indexes all Persona NFT creation and metadata
- Tracks bonding curve trades and liquidity events
- Monitors staking pools and user positions
- Records bridge activity (wrap/unwrap)
- Aggregates statistics (global and daily)
- Handles agent token functionality

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

### Testing locally:
```bash
# Reset database and start fresh
npm run db:reset

# Start processor with verbose logging
DEBUG=* npm run processor:start
```

## Deployment

For production deployment on Subsquid Cloud:
1. Update `squid.yaml` with your squid name
2. Install Subsquid CLI: `npm i -g @subsquid/cli`
3. Deploy: `sqd deploy`

## License

MIT
