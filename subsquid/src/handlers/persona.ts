import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona, PersonaMetadata } from '../model'
import { DEPLOYMENT } from '../processor'
import { Multicall } from '../abi/multicall'

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
  
  // Fetch additional data from contract
  const contract = new factoryAbi.Contract(ctx, log.block, DEPLOYMENT.addresses.personaFactory)
  
  try {
    // Get persona data from contract
    const personaData = await contract.personas(event.tokenId)
    
    // Get pairing config for graduation threshold
    let graduationThreshold = 0n
    if (personaData.pairToken && personaData.pairToken !== '0x0000000000000000000000000000000000000000') {
      try {
        const pairingConfig = await contract.pairingConfigs(personaData.pairToken)
        graduationThreshold = pairingConfig.graduationThreshold
      } catch (error) {
        ctx.log.warn(`Failed to fetch pairing config for ${personaData.pairToken}: ${error}`)
      }
    }
    
    persona = new Persona({
      id,
      tokenId: event.tokenId,
      creator: event.creator.toLowerCase(),
      owner: event.creator.toLowerCase(), // Initially owned by creator
      name: event.name,
      symbol: event.symbol,
      erc20Token: event.erc20Token.toLowerCase(),
      pairToken: personaData.pairToken.toLowerCase(),
      agentToken: personaData.agentToken !== '0x0000000000000000000000000000000000000000' 
        ? personaData.agentToken.toLowerCase() 
        : null,
      pairCreated: false,
      pairAddress: null,
      chainId: DEPLOYMENT.chainId,
      createdAt: timestamp,
      createdAtBlock: blockNumber,
      totalDeposited: 0n,
      tokensSold: 0n,
      graduationThreshold,
      totalAgentDeposited: 0n,
      minAgentTokens: personaData.minAgentTokens || 0n,
    })
    
    await ctx.store.insert(persona)
    
    ctx.log.info(`Created persona ${id}: ${event.name} on chain ${DEPLOYMENT.chainId}`)
    
    // Fetch initial metadata
    await fetchAndStoreMetadata(ctx, log.block, id, persona, timestamp, blockNumber)
    
  } catch (error) {
    ctx.log.error(`Failed to fetch persona data for ${id}: ${error}`)
    
    // Create with minimal data from event
    persona = new Persona({
      id,
      tokenId: event.tokenId,
      creator: event.creator.toLowerCase(),
      owner: event.creator.toLowerCase(),
      name: event.name,
      symbol: event.symbol,
      erc20Token: event.erc20Token.toLowerCase(),
      pairToken: '0x', // Will need to be updated later
      agentToken: null,
      pairCreated: false,
      pairAddress: null,
      chainId: DEPLOYMENT.chainId,
      createdAt: timestamp,
      createdAtBlock: blockNumber,
      totalDeposited: 0n,
      tokensSold: 0n,
      graduationThreshold: 0n,
      totalAgentDeposited: 0n,
      minAgentTokens: 0n,
    })
    
    await ctx.store.insert(persona)
  }
}

async function fetchAndStoreMetadata(
  ctx: Context,
  block: any,
  personaId: string,
  persona: Persona,
  timestamp: Date,
  blockNumber: bigint
) {
  const contract = new factoryAbi.Contract(ctx, block, DEPLOYMENT.addresses.personaFactory)
  
  // Common metadata keys to fetch
  const metadataKeys = ['image', 'description', 'twitter', 'telegram', 'website', 'discord']
  
  try {
    const metadataValues = await contract.getMetadata(BigInt(personaId), metadataKeys)
    
    for (let i = 0; i < metadataKeys.length; i++) {
      if (metadataValues[i] && metadataValues[i] !== '') {
        const metadataId = `${personaId}-${metadataKeys[i]}`
        
        const metadata = new PersonaMetadata({
          id: metadataId,
          persona,
          key: metadataKeys[i],
          value: metadataValues[i],
          updatedAt: timestamp,
          updatedAtBlock: blockNumber,
        })
        
        await ctx.store.insert(metadata)
        ctx.log.debug(`Stored metadata ${metadataKeys[i]} for persona ${personaId}`)
      }
    }
  } catch (error) {
    ctx.log.warn(`Failed to fetch metadata for persona ${personaId}: ${error}`)
  }
}
