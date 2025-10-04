import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona } from '../model'

export async function handleGraduated(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  // Event: Graduated(uint256 tokenId, bytes32 poolId, uint256 totalDeposited, uint256 tokensSold)
  const event = factoryAbi.events.Graduated.decode(log)

  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)

  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }

  // Update persona with graduation information
  persona.totalDeposited = event.totalDeposited
  persona.tokensSold = event.tokensSold
  persona.poolId = event.poolId
  persona.graduationTimestamp = BigInt(Math.floor(timestamp.getTime() / 1000))

  await ctx.store.save(persona)

  ctx.log.info(`Persona ${personaId} graduated!`)
  ctx.log.info(`  - Pool ID: ${event.poolId}`)
  ctx.log.info(`  - Total Deposited: ${event.totalDeposited}`)
  ctx.log.info(`  - Tokens Sold: ${event.tokensSold}`)
}

export async function handleTokensDistributed(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  // Event: TokensDistributed(uint256 tokenId, uint256 toAmica, uint256 toLiquidity, uint256 toAgentRewards)
  const event = factoryAbi.events.TokensDistributed.decode(log)

  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)

  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }

  ctx.log.info(`Tokens distributed for persona ${personaId}:`)
  ctx.log.info(`  - To Amica: ${event.toAmica}`)
  ctx.log.info(`  - To Liquidity: ${event.toLiquidity}`)
  ctx.log.info(`  - To Agent Rewards: ${event.toAgentRewards}`)

  // You may want to create a new entity to track token distributions
  // or update persona stats with this information
}
