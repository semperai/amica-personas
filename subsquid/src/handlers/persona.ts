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
  // New event structure: PersonaCreated(uint256 tokenId, bytes32 domain, address token)
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
    // Get persona data from contract - contains full details
    const personaData = await contract.personas(event.tokenId)

    // Get the token contract owner to determine creator
    // In the new version, we need to fetch the owner from the NFT
    const creatorAddress = await contract.ownerOf(event.tokenId)

    persona = new Persona({
      id,
      tokenId: event.tokenId,
      creator: creatorAddress.toLowerCase(),
      owner: creatorAddress.toLowerCase(), // Initially owned by creator
      name: '', // Name needs to be fetched from the ERC20 token or metadata
      symbol: '', // Symbol needs to be fetched from the ERC20 token or metadata
      erc20Token: event.token.toLowerCase(),
      // Note: domain, poolId, graduationTimestamp, agentTokenThreshold don't exist in current model
      // The model needs to be regenerated with these fields
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
      graduationThreshold: 0n, // This field exists but is deprecated
      totalAgentDeposited: 0n,
      minAgentTokens: personaData.agentTokenThreshold || 0n,
    })

    await ctx.store.insert(persona)

    ctx.log.info(`Created persona ${id} with domain ${event.domain} on chain ${DEPLOYMENT.chainId}`)

    // Fetch initial metadata
    await fetchAndStoreMetadata(ctx, log.block, id, persona, timestamp, blockNumber)

  } catch (error) {
    ctx.log.error(`Failed to fetch persona data for ${id}: ${error}`)

    // Create with minimal data from event
    persona = new Persona({
      id,
      tokenId: event.tokenId,
      creator: '0x0000000000000000000000000000000000000000', // Unknown
      owner: '0x0000000000000000000000000000000000000000',
      name: '',
      symbol: '',
      erc20Token: event.token.toLowerCase(),
      pairToken: '0x0000000000000000000000000000000000000000',
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

  // Convert string keys to bytes32 for the new contract
  for (const key of metadataKeys) {
    try {
      // Convert key to bytes32
      const keyBytes32 = '0x' + Buffer.from(key).toString('hex').padEnd(64, '0')

      const value = await contract.metadata(BigInt(personaId), keyBytes32)

      if (value && value !== '') {
        const metadataId = `${personaId}-${key}`

        const metadata = new PersonaMetadata({
          id: metadataId,
          persona,
          key: key,
          value: value,
          updatedAt: timestamp,
          updatedAtBlock: blockNumber,
        })

        await ctx.store.insert(metadata)
        ctx.log.debug(`Stored metadata ${key} for persona ${personaId}: ${value}`)
      }
    } catch (error) {
      ctx.log.warn(`Failed to fetch metadata ${key} for persona ${personaId}: ${error}`)
    }
  }
}
