import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { FeeConfig, UserSnapshot } from '../model'

export async function handleFeeReductionConfigUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  const event = factoryAbi.events.FeeReductionConfigUpdated.decode(log)
  
  let config = await ctx.store.get(FeeConfig, 'fee-config')
  
  if (!config) {
    config = new FeeConfig({
      id: 'fee-config',
      feePercentage: 100, // 1% default
      creatorShare: 5000, // 50% default
      minAmicaForReduction: event.minAmicaForReduction,
      maxAmicaForReduction: event.maxAmicaForReduction,
      minReductionMultiplier: Number(event.minReductionMultiplier),
      maxReductionMultiplier: Number(event.maxReductionMultiplier),
      lastUpdated: timestamp,
    })
  } else {
    config.minAmicaForReduction = event.minAmicaForReduction
    config.maxAmicaForReduction = event.maxAmicaForReduction
    config.minReductionMultiplier = Number(event.minReductionMultiplier)
    config.maxReductionMultiplier = Number(event.maxReductionMultiplier)
    config.lastUpdated = timestamp
  }
  
  await ctx.store.save(config)
  
  ctx.log.info(`Fee reduction config updated`)
}

export async function handleTradingFeeConfigUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  const event = factoryAbi.events.TradingFeeConfigUpdated.decode(log)
  
  let config = await ctx.store.get(FeeConfig, 'fee-config')
  
  if (!config) {
    config = new FeeConfig({
      id: 'fee-config',
      feePercentage: Number(event.feePercentage),
      creatorShare: Number(event.creatorShare),
      minAmicaForReduction: 1000n * 10n**18n, // Default values
      maxAmicaForReduction: 1000000n * 10n**18n,
      minReductionMultiplier: 9000,
      maxReductionMultiplier: 0,
      lastUpdated: timestamp,
    })
  } else {
    config.feePercentage = Number(event.feePercentage)
    config.creatorShare = Number(event.creatorShare)
    config.lastUpdated = timestamp
  }
  
  await ctx.store.save(config)
  
  ctx.log.info(`Trading fee config updated: ${event.feePercentage} basis points`)
}

export async function handleSnapshotUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  const event = factoryAbi.events.SnapshotUpdated.decode(log)
  
  const user = event.user.toLowerCase()
  let snapshot = await ctx.store.get(UserSnapshot, user)
  
  if (!snapshot) {
    snapshot = new UserSnapshot({
      id: user,
      user,
      currentBalance: 0n,
      currentBlock: 0n,
      pendingBalance: event.snapshotBalance,
      pendingBlock: event.blockNumber,
      lastUpdated: timestamp,
    })
  } else {
    // Move pending to current if delay has passed
    if (snapshot.pendingBlock > 0n && event.blockNumber >= snapshot.pendingBlock + 100n) {
      snapshot.currentBalance = snapshot.pendingBalance
      snapshot.currentBlock = snapshot.pendingBlock
    }
    
    snapshot.pendingBalance = event.snapshotBalance
    snapshot.pendingBlock = event.blockNumber
    snapshot.lastUpdated = timestamp
  }
  
  await ctx.store.save(snapshot)
  
  ctx.log.info(`Snapshot updated for user ${user}: ${event.snapshotBalance}`)
}
