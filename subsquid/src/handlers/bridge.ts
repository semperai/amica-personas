import { Context, Log } from '../processor'
import * as bridgeAbi from '../abi/AmicaBridgeWrapper'
import { BridgeActivity, BridgeAction } from '../model'
import { DEPLOYMENT } from '../processor'

export async function handleTokensWrapped(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = bridgeAbi.events.TokensWrapped.decode(log)

  const activityId = `${log.transactionHash}-${log.logIndex}`

  const activity = new BridgeActivity({
    id: activityId,
    user: event.user.toLowerCase(),
    action: BridgeAction.WRAP,
    amount: event.amount,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })

  await ctx.store.insert(activity)

  ctx.log.info(`Bridge wrap: ${event.amount} by ${event.user}`)
}

export async function handleTokensUnwrapped(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = bridgeAbi.events.TokensUnwrapped.decode(log)

  const activityId = `${log.transactionHash}-${log.logIndex}`

  const activity = new BridgeActivity({
    id: activityId,
    user: event.user.toLowerCase(),
    action: BridgeAction.UNWRAP,
    amount: event.amount,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })

  await ctx.store.insert(activity)

  ctx.log.info(`Bridge unwrap: ${event.amount} by ${event.user}`)
}

export async function handleEmergencyWithdraw(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  const event = bridgeAbi.events.EmergencyWithdraw.decode(log)

  const activity = new BridgeActivity({
    id: `${log.transactionHash}-${log.logIndex}`,
    user: event.to.toLowerCase(),
    action: BridgeAction.EMERGENCY_WITHDRAW,
    amount: event.amount,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })

  await ctx.store.insert(activity)
  ctx.log.warn(`Emergency withdraw: ${event.to} withdrew ${event.amount} of ${event.token}`)
}

export async function handleBridgeMetricsUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  const event = bridgeAbi.events.BridgeMetricsUpdated.decode(log)

  // Log for monitoring purposes
  ctx.log.info(`Bridge metrics updated at block ${blockNumber}: totalBridgedIn=${event.totalBridgedIn}, totalBridgedOut=${event.totalBridgedOut}, netBridged=${event.netBridged}`)

  // Could create a BridgeMetrics entity if we want to track over time
  // For now, we'll just log the event for monitoring
}

export async function handleBridgeTokensUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  const event = bridgeAbi.events.BridgeTokensUpdated.decode(log)

  // Log for monitoring purposes
  ctx.log.info(`Bridge tokens updated at block ${blockNumber}: oldBridgedToken=${event.oldBridgedToken}, newBridgedToken=${event.newBridgedToken}, newNativeToken=${event.newNativeToken}`)
}
