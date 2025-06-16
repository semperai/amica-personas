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
    amountIn: event.amountSpent,      // Pairing tokens spent
    amountOut: event.tokensReceived,   // Persona tokens received
    feeAmount: 0n, // Will be set by TradingFeesCollected event
    isBuy: true,   // This is a buy trade
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
  
  ctx.log.info(`Buy trade ${tradeId}: ${event.buyer} bought ${event.tokensReceived} tokens for ${event.amountSpent}`)
  
  return trade
}

export async function handleTokensSold(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<Trade | null> {
  const event = factoryAbi.events.TokensSold.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return null
  }
  
  const tradeId = `${log.transactionHash}-${log.logIndex}`
  
  // For sells, we store the persona tokens as amountIn and pairing tokens as amountOut
  const trade = new Trade({
    id: tradeId,
    persona,
    trader: event.seller.toLowerCase(),
    amountIn: event.tokensSold,       // Persona tokens sold
    amountOut: event.amountReceived,  // Pairing tokens received
    feeAmount: 0n, // Will be set by TradingFeesCollected event
    isBuy: false,  // This is a sell trade
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })
  
  await ctx.store.insert(trade)
  
  // Update persona stats - decrease tokens sold, decrease total deposited
  persona.tokensSold = persona.tokensSold - event.tokensSold
  persona.totalDeposited = persona.totalDeposited - event.amountReceived
  await ctx.store.save(persona)
  
  ctx.log.info(`Sell trade ${tradeId}: ${event.seller} sold ${event.tokensSold} tokens for ${event.amountReceived}`)
  
  return trade
}

export async function handleTradingFeesCollected(
  ctx: Context,
  log: Log
) {
  const event = factoryAbi.events.TradingFeesCollected.decode(log)
  
  // Find the most recent trade in this transaction
  // TradingFeesCollected is emitted right after TokensPurchased/TokensSold in the same transaction
  const trades = await ctx.store.find(Trade, {
    where: { txHash: log.transactionHash },
    order: { block: 'DESC' },
    take: 1
  })
  
  if (trades.length > 0) {
    const trade = trades[0]
    trade.feeAmount = event.totalFees
    await ctx.store.save(trade)
    
    const tradeType = trade.isBuy ? 'Buy' : 'Sell'
    ctx.log.info(`Updated ${tradeType} trade ${trade.id} with fees: ${event.totalFees}`)
    ctx.log.debug(`  - Creator fees: ${event.creatorFees}`)
    ctx.log.debug(`  - Amica fees: ${event.amicaFees}`)
    ctx.log.debug(`  - Total fees: ${event.totalFees}`)
  } else {
    ctx.log.warn(`No trade found for fees in tx ${log.transactionHash}`)
  }
}
