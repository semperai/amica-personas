import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona } from '../model'
import { DEPLOYMENT } from '../processor'

export async function handleV4PoolCreated(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = factoryAbi.events.V4PoolCreated.decode(log)

  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)

  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }

  // Update with V4 pool information
  persona.pairCreated = true
  persona.poolId = event.poolId

  // Read the positionTokenId from the contract
  const contract = new factoryAbi.Contract(ctx, { height: log.block.height }, DEPLOYMENT.addresses.personaFactory)
  const personaData = await contract.personas(event.tokenId)
  persona.positionTokenId = personaData.positionTokenId

  await ctx.store.save(persona)

  ctx.log.info(`Persona ${personaId} V4 pool created! Pool ID: ${event.poolId}, Liquidity: ${event.liquidity}, Position NFT: ${personaData.positionTokenId}`)
}
