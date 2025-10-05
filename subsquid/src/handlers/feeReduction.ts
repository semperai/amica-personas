import { Context, Log } from '../processor'
import * as feeReductionAbi from '../abi/FeeReductionSystem'
import { FeeConfig, UserSnapshot } from '../model'

export async function handleSnapshotUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  const event = feeReductionAbi.events.SnapshotUpdated.decode(log)

  const userId = event.user.toLowerCase()
  let snapshot = await ctx.store.get(UserSnapshot, userId)

  if (!snapshot) {
    snapshot = new UserSnapshot({
      id: userId,
      user: userId,
      activeBalance: 0n,
      activeBlock: 0n,
      pendingBalance: event.balance,
      pendingBlock: event.blockNumber,
      lastUpdated: timestamp,
    })
  } else {
    // Update pending balance
    snapshot.pendingBalance = event.balance
    snapshot.pendingBlock = event.blockNumber
    snapshot.lastUpdated = timestamp
  }

  await ctx.store.save(snapshot)

  ctx.log.info(`Snapshot updated for user ${userId}: balance=${event.balance}, block=${event.blockNumber}`)
}

export async function handleSnapshotActivated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  const event = feeReductionAbi.events.SnapshotActivated.decode(log)

  const userId = event.user.toLowerCase()
  let snapshot = await ctx.store.get(UserSnapshot, userId)

  if (!snapshot) {
    // Shouldn't happen, but create if it doesn't exist
    snapshot = new UserSnapshot({
      id: userId,
      user: userId,
      activeBalance: event.activeBalance,
      activeBlock: event.activationBlock,
      pendingBalance: 0n,
      pendingBlock: 0n,
      lastUpdated: timestamp,
    })
  } else {
    // Activate the pending snapshot
    snapshot.activeBalance = event.activeBalance
    snapshot.activeBlock = event.activationBlock
    snapshot.lastUpdated = timestamp
  }

  await ctx.store.save(snapshot)

  ctx.log.info(`Snapshot activated for user ${userId}: balance=${event.activeBalance}, block=${event.activationBlock}`)
}

export async function handleFeeReductionConfigUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  const event = feeReductionAbi.events.FeeReductionConfigUpdated.decode(log)

  const configId = 'fee-config'
  let config = await ctx.store.get(FeeConfig, configId)

  if (!config) {
    config = new FeeConfig({
      id: configId,
      minAmicaForReduction: event.minAmicaForReduction,
      maxAmicaForReduction: event.maxAmicaForReduction,
      baseFee: event.baseFee,
      maxDiscountedFee: event.maxDiscountedFee,
      lastUpdated: timestamp,
    })
  } else {
    config.minAmicaForReduction = event.minAmicaForReduction
    config.maxAmicaForReduction = event.maxAmicaForReduction
    config.baseFee = event.baseFee
    config.maxDiscountedFee = event.maxDiscountedFee
    config.lastUpdated = timestamp
  }

  await ctx.store.save(config)

  ctx.log.info(`Fee reduction config updated:`)
  ctx.log.info(`  - minAmicaForReduction: ${event.minAmicaForReduction}`)
  ctx.log.info(`  - maxAmicaForReduction: ${event.maxAmicaForReduction}`)
  ctx.log.info(`  - baseFee: ${event.baseFee}`)
  ctx.log.info(`  - maxDiscountedFee: ${event.maxDiscountedFee}`)
}
