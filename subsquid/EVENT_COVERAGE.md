# Complete Event Coverage Reference

This document provides a comprehensive overview of all events tracked by the Amica Subsquid indexer.

## Coverage Summary

- **Total Events Tracked:** 22/37 (59%)
- **Critical Events:** 22/22 (100% ✅)
- **Missing Critical Events:** 0
- **Optional Admin Events:** 15 (can be added later)

## Contract-by-Contract Breakdown

### 1. PersonaTokenFactory (15/21 events)

#### ✅ Core Business Logic Events

| Event | Purpose | Entity | Handler |
|-------|---------|--------|---------|
| `PersonaCreated` | NFT minting | `Persona` | `handlers/persona.ts` |
| `Transfer` | NFT transfers | `PersonaTransfer` | `handlers/transfers.ts` |
| `TokensPurchased` | Bonding curve buys | `Trade` | `handlers/trading.ts` |
| `TokensSold` | Bonding curve sells | `Trade` | `handlers/trading.ts` |
| `MetadataUpdated` | Metadata changes | `PersonaMetadata` | `handlers/metadata.ts` |
| `V4PoolCreated` | Uniswap V4 pool creation | `Persona` | `handlers/liquidity.ts` |
| `FeesCollected` | V4 pool fee collection | - | `handlers/trading.ts` |
| `Graduated` | Graduation events | `Persona` | `handlers/graduation.ts` |
| `TokensClaimed` | Post-graduation claims | `TokenWithdrawal` | `handlers/withdrawals.ts` |
| `TokensDistributed` | Token distribution | - | `handlers/graduation.ts` |
| `AgentTokenAssociated` | Agent token setup | `Persona` | `handlers/agent.ts` |
| `AgentTokensDeposited` | Agent deposits | `AgentDeposit` | `handlers/agent.ts` |
| `AgentTokensWithdrawn` | Agent withdrawals | `AgentDeposit` | `handlers/agent.ts` |
| `AgentRewardsDistributed` | Agent reward claims | `AgentReward` | `handlers/agent.ts` |
| `PairingConfigUpdated` | Config changes | `PairingConfig` | `handlers/config.ts` |

#### ⊘ Optional Admin Events (Not Tracked)

- `Approval`, `ApprovalForAll` - NFT approvals
- `Initialized` - Contract initialization
- `OwnershipTransferred` - Owner changes
- `Paused`, `Unpaused` - Emergency pause state

### 2. AmicaToken (2/7 events)

#### ✅ Critical Token Flow Events

| Event | Purpose | Entity | Handler | Notes |
|-------|---------|--------|---------|-------|
| `Transfer` | **ALL AMICA transfers** | `AmicaTransfer` | `handlers/amica-token.ts` | Includes context flags for Factory/Staking/Bridge |
| `TokenClaimed` | Burn & claim mechanism | `AmicaClaim` | `handlers/amica-token.ts` | Tracks amount burned and claimed |

**Context Tracking:** The `Transfer` handler includes boolean flags:
- `isToFactory` / `isFromFactory` - Transfers to/from PersonaFactory
- `isToStaking` / `isFromStaking` - Transfers to/from Staking contract
- `isToBridge` / `isFromBridge` - Transfers to/from Bridge contract

This enables queries like:
- "Show all AMICA deposits into the factory"
- "Track staking contract balance over time"
- "Monitor large token movements"

#### ⊘ Optional Admin Events (Not Tracked)

- `Approval` - ERC20 approvals
- `Initialized`, `OwnershipTransferred`, `Paused`, `Unpaused` - Admin operations

### 3. AmicaBridgeWrapper (5/9 events)

#### ✅ Critical Bridge Events

| Event | Purpose | Entity | Handler |
|-------|---------|--------|---------|
| `TokensWrapped` | AMICA wrapping | `BridgeActivity` | `handlers/bridge.ts` |
| `TokensUnwrapped` | AMICA unwrapping | `BridgeActivity` | `handlers/bridge.ts` |
| `EmergencyWithdraw` | **Security: Emergency exits** | `BridgeActivity` | `handlers/bridge.ts` |
| `BridgeMetricsUpdated` | Bridge health metrics | Logged | `handlers/bridge.ts` |
| `BridgeTokensUpdated` | Config changes | Logged | `handlers/bridge.ts` |

**Security Monitoring:** `EmergencyWithdraw` events are logged with warnings for security monitoring.

#### ⊘ Optional Admin Events (Not Tracked)

- `Initialized`, `OwnershipTransferred`, `Paused`, `Unpaused` - Admin operations

### 4. PersonaStakingRewards (7/21 events)

#### ✅ Core Staking Events

| Event | Purpose | Entity | Handler |
|-------|---------|--------|---------|
| `PoolAdded` | Pool creation | `StakingPool` | `handlers/staking.ts` |
| `PoolUpdated` | Pool config changes | `StakingPool` | `handlers/staking.ts` |
| `Deposit` | Flexible staking | `UserStake` | `handlers/staking.ts` |
| `DepositLocked` | Locked staking | `UserStake`, `StakeLock` | `handlers/staking.ts` |
| `Withdraw` | Flexible withdrawals | `UserStake` | `handlers/staking.ts` |
| `WithdrawLocked` | Locked withdrawals | `StakeLock` | `handlers/staking.ts` |
| `RewardsClaimed` | Reward claims | `StakingRewardClaim` | `handlers/staking.ts` |

#### ⚠ Additional Events (Can Be Added If Needed)

- `EmergencyExit` - Emergency withdrawals
- `EmergencyWithdrawCompleted` - Emergency admin withdrawals
- `LockTierAdded`, `LockTierUpdated` - Lock tier management
- `PoolDeactivated` - Pool deactivation
- `RewardPeriodUpdated`, `RewardRateUpdated` - Reward configuration

## Testing Event Coverage

### Check What Events Are Tracked

```bash
npm run test:coverage
```

This runs the `event-coverage-check.js` script which:
- Compares ABI events against processor configuration
- Identifies missing critical events
- Provides recommendations

### Verify Events Are Being Indexed

```bash
npm run test:events
```

This runs the `test-event-queries.js` script which:
- Queries database for each event type
- Shows sample data for each entity
- Reports which events have data and which are empty

### Full Test Suite

```bash
# 1. Check coverage
npm run test:coverage

# 2. Start database
./test-local.sh start

# 3. Start processor (in another terminal)
npm run processor:start

# 4. Wait a few minutes, then test
npm run test:events

# 5. Test GraphQL queries
./test-local.sh query
```

## Entity-to-Event Mapping

| Entity | Created By | Updated By |
|--------|------------|------------|
| `Persona` | PersonaCreated | Transfer, V4PoolCreated, Graduated, AgentTokenAssociated |
| `Trade` | TokensPurchased, TokensSold | - |
| `AgentDeposit` | AgentTokensDeposited | AgentTokensWithdrawn |
| `AgentReward` | AgentRewardsDistributed | - |
| `PersonaTransfer` | Transfer (NFT) | - |
| `TokenWithdrawal` | TokensClaimed | - |
| `PersonaMetadata` | MetadataUpdated | MetadataUpdated |
| `StakingPool` | PoolAdded | PoolUpdated |
| `UserStake` | Deposit, DepositLocked | Withdraw, WithdrawLocked |
| `StakeLock` | DepositLocked | WithdrawLocked |
| `StakingRewardClaim` | RewardsClaimed | - |
| `BridgeActivity` | TokensWrapped, TokensUnwrapped, EmergencyWithdraw | - |
| `AmicaTransfer` | Transfer (ERC20) | - |
| `AmicaClaim` | TokenClaimed | - |
| `PairingConfig` | PairingConfigUpdated | PairingConfigUpdated |

## GraphQL Query Examples

### Track AMICA Token Flows

```graphql
# Get all AMICA transfers to PersonaFactory
query {
  amicaTransfers(
    where: { isToFactory_eq: true }
    orderBy: timestamp_DESC
    limit: 10
  ) {
    from
    to
    value
    timestamp
  }
}

# Get all AMICA transfers from Staking contract
query {
  amicaTransfers(
    where: { isFromStaking_eq: true }
    orderBy: timestamp_DESC
    limit: 10
  ) {
    from
    to
    value
    timestamp
  }
}

# Monitor large AMICA movements (>1000 tokens)
query {
  amicaTransfers(
    where: { value_gte: "1000000000000000000000" }
    orderBy: value_DESC
    limit: 20
  ) {
    from
    to
    value
    isToFactory
    isFromFactory
    timestamp
  }
}
```

### Track Burn & Claim

```graphql
query {
  amicaClaims(orderBy: timestamp_DESC, limit: 10) {
    user
    claimedToken
    amountBurned
    amountClaimed
    timestamp
  }
}
```

### Monitor Emergency Events

```graphql
query {
  bridgeActivities(
    where: { action_eq: EMERGENCY_WITHDRAW }
    orderBy: timestamp_DESC
  ) {
    user
    amount
    timestamp
    txHash
  }
}
```

### Track Graduations

```graphql
query {
  personas(
    where: { pairCreated_eq: true }
    orderBy: createdAt_DESC
  ) {
    name
    symbol
    pairAddress
    totalDeposited
    tokensSold
  }
}
```

## Adding New Events

If you need to track additional events:

1. **Update processor.ts:**
   ```typescript
   .addLog({
     address: [DEPLOYMENT.addresses.contractName],
     topic0: [
       contractAbi.events.NewEvent.topic,
     ]
   })
   ```

2. **Create/Update handler:**
   ```typescript
   export async function handleNewEvent(
     ctx: Context,
     log: Log,
     timestamp: Date,
     blockNumber: bigint
   ): Promise<void> {
     const event = contractAbi.events.NewEvent.decode(log)
     // Create entity and save
   }
   ```

3. **Wire up in main.ts:**
   ```typescript
   case contractAbi.events.NewEvent.topic:
     await handleNewEvent(ctx, log, timestamp, blockNumber)
     break
   ```

4. **Test:**
   ```bash
   npm run build
   npm run test:coverage
   ```

## Performance Considerations

### High-Volume Events

The `AmicaToken.Transfer` event is high-volume and creates many database records. The handler includes optimizations:

1. **Skips mint/burn events** (from/to zero address)
2. **Indexes key fields** (from, to, value, timestamp)
3. **Context flags** enable efficient queries without joins

### Storage Estimates

Based on typical usage:
- **AmicaTransfer:** ~100-1000 records/day
- **Trade:** ~50-500 records/day
- **StakingRewardClaim:** ~10-100 records/day
- **BridgeActivity:** ~10-50 records/day

Total expected growth: ~1-5 GB/year with normal activity.

## Monitoring and Alerts

Consider adding alerts for:
- `EmergencyWithdraw` events (security)
- Large `AmicaTransfer` amounts (>10k tokens)
- Failed indexing (error count)
- Indexer lag (blocks behind current)

Use the validation script to check health:
```bash
npm run test:validate
```
