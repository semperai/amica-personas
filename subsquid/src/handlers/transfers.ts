import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona, PersonaTransfer } from '../model'
import { DEPLOYMENT } from '../processor'

export async function handleTransfer(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = factoryAbi.events.Transfer.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found for transfer: ${personaId}`)
    return
  }
  
  // Update persona owner
  const previousOwner = persona.owner
  persona.owner = event.to.toLowerCase()
  await ctx.store.save(persona)
  
  // Create transfer record
  const transferId = `${log.transactionHash}-${log.logIndex}`
  const transfer = new PersonaTransfer({
    id: transferId,
    persona,
    from: event.from.toLowerCase(),
    to: event.to.toLowerCase(),
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })
  
  await ctx.store.insert(transfer)
  
  ctx.log.info(`Persona ${personaId} transferred from ${event.from} to ${event.to}`)
}
