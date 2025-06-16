// Create new file: src/handlers/config.ts

import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { DEPLOYMENT } from '../processor'

export async function handlePairingConfigUpdated(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  const event = factoryAbi.events.PairingConfigUpdated.decode(log)
  
  // Fetch the updated configuration from the contract
  const contract = new factoryAbi.Contract(ctx, log.block, DEPLOYMENT.addresses.personaFactory)
  
  try {
    const config = await contract.pairingConfigs(event.token)
    
    ctx.log.info(`Pairing config updated for token ${event.token}:`)
    ctx.log.info(`  - Enabled: ${config.enabled}`)
    ctx.log.info(`  - Mint Cost: ${config.mintCost}`)
    ctx.log.info(`  - Graduation Threshold: ${config.graduationThreshold}`)
    
    // If you want to store this in the database, you'll need to create a PairingConfig entity
    // For now, we'll just log it
    
    // Optional: Update all personas using this pairing token with new graduation threshold
    // This would require querying all personas with this pairToken and updating their graduationThreshold
    
  } catch (error) {
    ctx.log.error(`Failed to fetch pairing config for ${event.token}: ${error}`)
  }
}

export async function handleStakingRewardsSet(
  ctx: Context,
  log: Log
) {
  const event = factoryAbi.events.StakingRewardsSet.decode(log)
  
  ctx.log.info(`Staking rewards contract updated to: ${event.stakingRewards}`)
  
  // Check if this matches our configured staking rewards address
  if (event.stakingRewards.toLowerCase() !== DEPLOYMENT.addresses.stakingRewards) {
    ctx.log.warn(`⚠️  Staking rewards address mismatch!`)
    ctx.log.warn(`  - Event: ${event.stakingRewards}`)
    ctx.log.warn(`  - Config: ${DEPLOYMENT.addresses.stakingRewards}`)
    ctx.log.warn(`  - You may need to update your processor configuration`)
  }
  
  // This event indicates the factory now knows about the staking rewards contract
  // It doesn't require any data updates, but it's good to track for monitoring
}
