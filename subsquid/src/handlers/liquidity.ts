import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona } from '../model'

export async function handleLiquidityPairCreated(
  ctx: Context,
  log: Log
) {
  const event = factoryAbi.events.LiquidityPairCreated.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }
  
  persona.pairCreated = true
  persona.pairAddress = event.pair.toLowerCase()
  await ctx.store.save(persona)
  
  ctx.log.info(`Liquidity pair created for persona ${personaId}: ${event.pair}`)
}
