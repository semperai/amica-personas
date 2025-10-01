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
    // New config structure: enabled, mintCost, pricingMultiplier (no graduationThreshold)
    const config = await contract.pairingConfigs(event.token)

    ctx.log.info(`Pairing config updated for token ${event.token}:`)
    ctx.log.info(`  - Enabled: ${config.enabled}`)
    ctx.log.info(`  - Mint Cost: ${config.mintCost}`)
    ctx.log.info(`  - Pricing Multiplier: ${config.pricingMultiplier}`)

    // If you want to store this in the database, you'll need to create a PairingConfig entity
    // For now, we'll just log it

  } catch (error) {
    ctx.log.error(`Failed to fetch pairing config for ${event.token}: ${error}`)
  }
}

