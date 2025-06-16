import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona } from '../model'

export async function handlePersonaCreated(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = factoryAbi.events.PersonaCreated.decode(log)
  
  const id = event.tokenId.toString()
  
  // Check if persona already exists (shouldn't happen but be safe)
  let persona = await ctx.store.get(Persona, id)
  if (persona) {
    ctx.log.warn(`Persona ${id} already exists`)
    return
  }
  
  persona = new Persona({
    id,
    tokenId: event.tokenId,
    creator: event.creator.toLowerCase(),
    owner: event.creator.toLowerCase(), // Initially owned by creator
    name: event.name,
    symbol: event.symbol,
    erc20Token: event.erc20Token.toLowerCase(),
    pairToken: '0x', // Will be set from contract call or metadata
    agentToken: null,
    pairCreated: false,
    pairAddress: null,
    createdAt: timestamp,
    createdAtBlock: blockNumber,
    totalDeposited: 0n,
    tokensSold: 0n,
    graduationThreshold: 0n, // Will be set from config
    totalAgentDeposited: 0n,
    minAgentTokens: 0n,
  })
  
  await ctx.store.insert(persona)
  
  ctx.log.info(`Created persona ${id}: ${event.name}`)
}
