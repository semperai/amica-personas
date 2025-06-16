import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona, Trade } from '../model'
import { DEPLOYMENT } from '../processor'

export async function handleTokensPurchased(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<Trade | null> {
  const event = factoryAbi.events.TokensPurchased.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return null
  }
  
  const tradeId = `${log.transactionHash}-${log.logIndex}`
  
  const trade = new Trade({
    id: tradeId,
    persona,
    trader: event.buyer.toLowerCase(),
    amountIn: event.amountSpent,
    amountOut: event.tokensReceived,
    feeAmount: 0n, // Will be set by TradingFeesCollected event
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })
  
  await ctx.store.insert(trade)
  
  // Update persona stats
  persona.totalDeposited = persona.totalDeposited + event.amountSpent
  persona.tokensSold = persona.tokensSold + event.tokensReceived
  await ctx.store.save(persona)
  
  ctx.log.info(`Trade ${tradeId}: ${event.buyer} bought ${event.tokensReceived} tokens`)
  
  return trade
}

export async function handleTradingFeesCollected(
  ctx: Context,
  log: Log
) {
  const event = factoryAbi.events.TradingFeesCollected.decode(log)
  
  // Find the most recent trade in this transaction
  const trades = await ctx.store.find(Trade, {
    where: { txHash: log.transactionHash },
    order: { block: 'DESC' },
    take: 1
  })
  
  if (trades.length > 0) {
    const trade = trades[0]
    trade.feeAmount = event.totalFees
    await ctx.store.save(trade)
    
    ctx.log.info(`Updated trade ${trade.id} with fees: ${event.totalFees}`)
  }
}
