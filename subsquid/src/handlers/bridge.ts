import { Context, Log } from '../processor'
import * as bridgeAbi from '../abi/AmicaBridgeWrapper'
import { BridgeActivity, BridgeAction } from '../model'

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
  })
  
  await ctx.store.insert(activity)
  
  ctx.log.info(`Bridge unwrap: ${event.amount} by ${event.user}`)
}
