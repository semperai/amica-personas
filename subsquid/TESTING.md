# Subsquid Local Testing Guide

This guide explains how to test the Amica Subsquid indexer locally to verify that all contract events are being indexed correctly.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ installed
- `.env` file configured (copy from `.env.test` if needed)

## Quick Start

### Option 1: Manual Setup (Recommended for Development)

1. **Start the database**
   ```bash
   ./test-local.sh start
   ```

2. **Run the processor** (in a separate terminal)
   ```bash
   npm run processor:start
   ```

3. **Start the GraphQL server** (in another terminal)
   ```bash
   npm run serve
   ```

4. **Validate indexing** (in another terminal)
   ```bash
   node scripts/validate-indexing.js
   ```

### Option 2: Full Docker Stack

Run everything with docker-compose:
```bash
./test-local.sh full
```

This starts the database, processor, and GraphQL server all at once.

## Available Test Scripts

### `./test-local.sh`

Main testing script with multiple commands:

- **`start`** - Start database and run migrations
- **`stop`** - Stop all services
- **`reset`** - Reset database (⚠️ deletes all data)
- **`test`** - Run processor in test mode
- **`full`** - Start full stack with docker-compose
- **`logs`** - Show logs from all services
- **`query`** - Run sample GraphQL queries

### `node scripts/validate-indexing.js`

Validation script that checks:
- Database connectivity
- Processor status and latest block
- Entity counts (Personas, Trades, Staking, etc.)
- Recent personas created
- Global statistics
- GraphQL server connectivity

## Testing Workflow

### 1. Initial Setup

```bash
# Build the project
npm run build

# Start database
./test-local.sh start

# Start processor
npm run processor:start
```

### 2. Verify Indexing

Wait a few minutes for the processor to index blocks, then:

```bash
# Check indexing status
node scripts/validate-indexing.js
```

Expected output:
```
✓ Database connection successful
✓ Latest indexed block: 31632211
✓ persona: 150 records
✓ trade: 2431 records
✓ Indexer appears to be running
```

### 3. Test GraphQL Queries

Start the GraphQL server:
```bash
npm run serve
```

Then test queries:
```bash
./test-local.sh query
```

Or access the GraphQL playground at: http://localhost:4000/graphql

### 4. Sample Queries

**Get total personas:**
```graphql
query {
  globalStats {
    totalPersonas
    totalTrades
    totalBuyTrades
    totalSellTrades
    totalVolume
  }
}
```

**Get recent personas:**
```graphql
query {
  personas(limit: 10, orderBy: createdAt_DESC) {
    id
    tokenId
    name
    symbol
    creator
    owner
    pairCreated
    totalDeposited
    tokensSold
    createdAt
  }
}
```

**Get trades for a persona:**
```graphql
query {
  trades(
    where: { persona: { tokenId_eq: "1" } }
    orderBy: timestamp_DESC
    limit: 20
  ) {
    id
    trader
    amountIn
    amountOut
    feeAmount
    isBuy
    timestamp
  }
}
```

**Get staking pools:**
```graphql
query {
  stakingPools(orderBy: totalStaked_DESC) {
    poolId
    lpToken
    isAgentPool
    totalStaked
    isActive
    userStakes(limit: 5) {
      user
      flexibleAmount
      lockedAmount
      unclaimedRewards
    }
  }
}
```

**Get agent deposits:**
```graphql
query {
  agentDeposits(
    where: { withdrawn_eq: false }
    orderBy: timestamp_DESC
  ) {
    id
    persona {
      name
      symbol
    }
    user
    amount
    rewardsClaimed
    timestamp
  }
}
```

## Troubleshooting

### Processor not indexing

1. Check if the RPC endpoint is accessible:
   ```bash
   curl https://mainnet.base.org
   ```

2. Check processor logs:
   ```bash
   docker compose logs processor
   ```

3. Verify environment variables:
   ```bash
   cat .env
   ```

### Database connection errors

1. Check if PostgreSQL is running:
   ```bash
   docker compose ps
   ```

2. Test connection manually:
   ```bash
   psql postgresql://postgres:postgres@localhost:5432/amica_indexer
   ```

3. Reset database if needed:
   ```bash
   ./test-local.sh reset
   ```

### GraphQL server errors

1. Check if port 4000 is available:
   ```bash
   lsof -i :4000
   ```

2. Check database schema is up to date:
   ```bash
   npm run db:migrate
   ```

## Event Coverage

The indexer handles these contract events:

### PersonaTokenFactory
- ✅ PersonaCreated
- ✅ Transfer
- ✅ TokensPurchased
- ✅ TokensSold
- ✅ MetadataUpdated
- ✅ V4PoolCreated
- ✅ FeesCollected
- ✅ Graduated
- ✅ TokensClaimed
- ✅ TokensDistributed
- ✅ AgentTokenAssociated
- ✅ AgentTokensDeposited
- ✅ AgentTokensWithdrawn
- ✅ AgentRewardsDistributed
- ✅ PairingConfigUpdated

### PersonaStakingRewards
- ✅ PoolAdded
- ✅ PoolUpdated
- ✅ Deposit
- ✅ DepositLocked
- ✅ Withdraw
- ✅ WithdrawLocked
- ✅ RewardsClaimed

### AmicaBridgeWrapper
- ✅ TokensWrapped
- ✅ TokensUnwrapped

## Performance Monitoring

Monitor processor performance:
```bash
# Check Prometheus metrics
curl http://localhost:3000/metrics

# Watch processor logs
docker compose logs -f processor

# Check database size
docker compose exec db psql -U postgres -d amica_indexer -c "\dt+"
```

## CI/CD Integration

For automated testing in CI:

```bash
# Start services
docker compose up -d db
sleep 10

# Run migrations
npm run db:migrate

# Build
npm run build

# Start processor (background)
npm run processor:start &
sleep 30

# Validate
node scripts/validate-indexing.js

# Cleanup
docker compose down
```

## Additional Resources

- [Subsquid Documentation](https://docs.subsquid.io/)
- [GraphQL Query Documentation](http://localhost:4000/graphql)
- [Contract ABIs](./src/abi/)
- [Schema Definition](./schema.graphql)
