import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona } from '../model'

export async function handleV4PoolCreated(
  ctx: Context,
  log: Log
) {
  // New event: V4PoolCreated(uint256 tokenId, bytes32 poolId, uint256 liquidity)
  const event = factoryAbi.events.V4PoolCreated.decode(log)

  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)

  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }

  // Update with V4 pool information
  persona.pairCreated = true
  // persona.poolId = event.poolId  // Field doesn't exist in current model yet
  await ctx.store.save(persona)

  ctx.log.info(`Persona ${personaId} V4 pool created! Pool ID: ${event.poolId}, Liquidity: ${event.liquidity}`)
}
