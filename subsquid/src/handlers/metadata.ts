import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona, PersonaMetadata } from '../model'
import { DEPLOYMENT } from '../processor'

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
  
  // Fetch the actual metadata value from the contract
  const contract = new factoryAbi.Contract(ctx, log.block, DEPLOYMENT.addresses.personaFactory)
  
  try {
    const metadataValues = await contract.getMetadata(event.tokenId, [event.key])
    const value = metadataValues[0] || ''
    
    const metadataId = `${personaId}-${event.key}`
    let metadata = await ctx.store.get(PersonaMetadata, metadataId)
    
    if (!metadata) {
      metadata = new PersonaMetadata({
        id: metadataId,
        persona,
        key: event.key,
        value,
        updatedAt: timestamp,
        updatedAtBlock: blockNumber,
      })
    } else {
      metadata.value = value
      metadata.updatedAt = timestamp
      metadata.updatedAtBlock = blockNumber
    }
    
    await ctx.store.save(metadata)
    
    ctx.log.info(`Updated metadata for persona ${personaId}: ${event.key} = ${value}`)
  } catch (error) {
    ctx.log.error(`Failed to fetch metadata value for ${personaId}/${event.key}: ${error}`)
  }
}
