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
  // Protect against underflow
  if (persona.tokensSold >= event.tokensSold) {
    persona.tokensSold = persona.tokensSold - event.tokensSold
  } else {
    ctx.log.warn(`Underflow prevented: persona ${personaId} tokensSold (${persona.tokensSold}) < event.tokensSold (${event.tokensSold})`)
    persona.tokensSold = 0n
  }
  
  if (persona.totalDeposited >= event.amountReceived) {
    persona.totalDeposited = persona.totalDeposited - event.amountReceived
  } else {
    ctx.log.warn(`Underflow prevented: persona ${personaId} totalDeposited (${persona.totalDeposited}) < event.amountReceived (${event.amountReceived})`)
    persona.totalDeposited = 0n
  }
  
  await ctx.store.save(persona)
  
  ctx.log.info(`Sell trade ${tradeId}: ${event.seller} sold ${event.tokensSold} tokens for ${event.amountReceived}`)
  
  return trade
}

export async function handleTradingFeesCollected(
  ctx: Context,
  log: Log
) {
  const event = factoryAbi.events.TradingFeesCollected.decode(log)
  
  // Find the trade that corresponds to this fee event
  // The TradingFeesCollected event should be emitted in the same transaction
  // as either TokensPurchased or TokensSold, and should have a lower log index
  
  // First, try to find trades in the same transaction
  const trades = await ctx.store.find(Trade, {
    where: { 
      txHash: log.transactionHash,
      persona: { tokenId: event.tokenId }
    },
    order: { id: 'ASC' }
  })
  
  if (trades.length === 0) {
    ctx.log.warn(`No trades found for fees in tx ${log.transactionHash} for persona ${event.tokenId}`)
    return
  }
  
  // Find the trade that doesn't have fees set yet
  // The fee event should come after the trade event in the same transaction
  let targetTrade: Trade | null = null
  
  for (const trade of trades) {
    // Extract log index from trade ID (format: txHash-logIndex)
    const tradeLogIndex = parseInt(trade.id.split('-')[1])
    
    // The fee event should have a higher log index than the trade event
    if (tradeLogIndex < log.logIndex && trade.feeAmount === 0n) {
      targetTrade = trade
      break
    }
  }
  
  if (targetTrade) {
    targetTrade.feeAmount = event.totalFees
    await ctx.store.save(targetTrade)
    
    const tradeType = targetTrade.isBuy ? 'Buy' : 'Sell'
    ctx.log.info(`Updated ${tradeType} trade ${targetTrade.id} with fees: ${event.totalFees}`)
    ctx.log.debug(`  - Creator fees: ${event.creatorFees}`)
    ctx.log.debug(`  - Amica fees: ${event.amicaFees}`)
    ctx.log.debug(`  - Total fees: ${event.totalFees}`)
  } else {
    // This might happen if events are processed out of order
    // or if there are multiple trades in the same transaction
    ctx.log.warn(`Could not match fee event to a specific trade in tx ${log.transactionHash}`)
    ctx.log.warn(`Found ${trades.length} trades, but none matched the fee event criteria`)
    
    // As a fallback, update the most recent trade without fees
    const unfeeTrade = trades.find(t => t.feeAmount === 0n)
    if (unfeeTrade) {
      unfeeTrade.feeAmount = event.totalFees
      await ctx.store.save(unfeeTrade)
      ctx.log.info(`Fallback: Updated trade ${unfeeTrade.id} with fees: ${event.totalFees}`)
    }
  }
}
