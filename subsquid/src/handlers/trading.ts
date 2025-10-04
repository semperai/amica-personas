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

export async function handleFeesCollected(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  // Event: FeesCollected(uint256 indexed tokenId, bytes32 poolId, uint256 amount0, uint256 amount1)
  const event = factoryAbi.events.FeesCollected.decode(log)

  ctx.log.info(`Fees collected for token ${event.tokenId}, pool ${event.poolId}`)
  ctx.log.debug(`  - Amount0: ${event.amount0}`)
  ctx.log.debug(`  - Amount1: ${event.amount1}`)

  // This event is for V4 pool fee collection after graduation
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)

  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }

  // The fees are collected from the V4 pool after graduation
  ctx.log.info(`V4 pool fees collected for persona ${personaId}: ${event.amount0} (token0), ${event.amount1} (token1)`)
}
