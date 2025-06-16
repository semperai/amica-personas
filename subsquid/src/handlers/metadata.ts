import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona, PersonaMetadata } from '../model'

export async function handleMetadataUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = factoryAbi.events.MetadataUpdated.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }
  
  const metadataId = `${personaId}-${event.key}`
  let metadata = await ctx.store.get(PersonaMetadata, metadataId)
  
  if (!metadata) {
    metadata = new PersonaMetadata({
      id: metadataId,
      persona,
      key: event.key,
      value: '', // Value will need to be fetched from contract
      updatedAt: timestamp,
      updatedAtBlock: blockNumber,
    })
  } else {
    metadata.updatedAt = timestamp
    metadata.updatedAtBlock = blockNumber
  }
  
  await ctx.store.save(metadata)
  
  ctx.log.info(`Updated metadata for persona ${personaId}: ${event.key}`)
}
