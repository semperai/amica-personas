import { TypeormDatabase } from '@subsquid/typeorm-store'
import { processor, Context, Log, DEPLOYMENT } from './processor'
import * as factoryAbi from './abi/PersonaTokenFactory'
import * as bridgeAbi from './abi/AmicaBridgeWrapper'
import * as amicaAbi from './abi/AmicaTokenMainnet'
import {
  Persona,
  PersonaMetadata,
  Trade,
  AgentDeposit,
  AgentReward,
  BridgeActivity,
  BridgeAction,
  FeeConfig,
  UserSnapshot,
  GlobalStats,
  DailyStats,
  PersonaDailyStats,
  PersonaTransfer,
  TokenWithdrawal,
} from './model'
import { And, In, MoreThanOrEqual, LessThan, Between } from 'typeorm'

// Event handlers
import { handlePersonaCreated } from './handlers/persona'
import { handleTokensPurchased, handleFeesCollected, handleTokensSold } from './handlers/trading'
import { handleMetadataUpdated } from './handlers/metadata'
import { handleV4PoolCreated } from './handlers/liquidity'
import {
  handleAgentTokenAssociated,
  handleAgentTokensDeposited,
  handleAgentTokensWithdrawn,
  handleAgentRewardsDistributed
} from './handlers/agent'
import {
  handleTokensWrapped,
  handleTokensUnwrapped,
  handleEmergencyWithdraw,
  handleBridgeMetricsUpdated,
  handleBridgeTokensUpdated
} from './handlers/bridge'
import { handleAmicaTransfer, handleAmicaTokenClaimed, handleAmicaTokenDeposited, handleAmicaTokenConfigured, handleAmicaTokenWithdrawn } from './handlers/amica-token'
import { updateGlobalStats, updateDailyStats } from './handlers/stats'
import { handleTransfer } from './handlers/transfers'
import { handleTokensClaimed } from './handlers/withdrawals'
import { handlePairingConfigUpdated } from './handlers/config'
import { handleGraduated, handleTokensDistributed } from './handlers/graduation'


// Log startup information
console.log('=== SUBSQUID PROCESSOR STARTING ===')
console.log(`Chain: ${DEPLOYMENT.chainName} (${DEPLOYMENT.chainId})`)
console.log(`Start Block: ${DEPLOYMENT.startBlock}`)
console.log('Addresses:')
console.log(`  - PersonaFactory: ${DEPLOYMENT.addresses.personaFactory}`)
console.log(`  - BridgeWrapper: ${DEPLOYMENT.addresses.bridgeWrapper}`)
console.log(`  - AmicaToken: ${DEPLOYMENT.addresses.amicaToken}`)
console.log('Environment:')
console.log(`  - RPC_BASE_HTTP: ${process.env.RPC_BASE_HTTP ? 'Set' : 'Not set'}`)
console.log(`  - Database URL: ${process.env.DB_URL ? 'Set' : 'Not set'}`)
console.log('===================================')

processor.run(new TypeormDatabase({ supportHotBlocks: true }), async (ctx) => {
  ctx.log.info(`Processing batch: ${ctx.blocks.length} blocks`)
  ctx.log.debug(`Block range: ${ctx.blocks[0]?.header.height} - ${ctx.blocks[ctx.blocks.length - 1]?.header.height}`)
  
  const blocks: Set<number> = new Set()
  const personasToUpdate: Set<string> = new Set()
  const datesToUpdate: Set<string> = new Set()
  
  let totalLogsProcessed = 0
  let eventsProcessed = {
    personaFactory: 0,
    bridgeWrapper: 0,
    amicaToken: 0,
    errors: 0
  }

  // Process all events
  for (let block of ctx.blocks) {
    blocks.add(block.header.height)
    
    ctx.log.trace(`Processing block ${block.header.height} with ${block.logs.length} logs`)
    
    for (let log of block.logs) {
      totalLogsProcessed++
      
      if (!log.address) {
        ctx.log.warn(`Log without address at block ${block.header.height}`)
        continue
      }
      
      const address = log.address.toLowerCase()
      const timestamp = new Date(block.header.timestamp)
      const blockNumber = BigInt(block.header.height)
      
      try {
        // PersonaTokenFactory events
        if (address === DEPLOYMENT.addresses.personaFactory) {
          eventsProcessed.personaFactory++
          const topic = log.topics[0]
          ctx.log.debug(`PersonaFactory event: ${topic} at block ${blockNumber}`)
          
          switch (topic) {
            case factoryAbi.events.PersonaCreated.topic:
              ctx.log.info('Processing PersonaCreated event')
              await handlePersonaCreated(ctx, log, timestamp, blockNumber)
              break
              
            case factoryAbi.events.Transfer.topic:
              ctx.log.info('Processing Transfer event')
              await handleTransfer(ctx, log, timestamp, blockNumber)
              const transferEvent = factoryAbi.events.Transfer.decode(log)
              personasToUpdate.add(transferEvent.tokenId.toString())
              break
              
            case factoryAbi.events.TokensPurchased.topic:
              ctx.log.info('Processing TokensPurchased event')
              const trade = await handleTokensPurchased(ctx, log, timestamp, blockNumber)
              if (trade) {
                personasToUpdate.add(trade.persona.id)
                datesToUpdate.add(getDateString(timestamp))
                ctx.log.debug(`Trade recorded for persona ${trade.persona.id}`)
              }
              break

            case factoryAbi.events.TokensSold.topic:
              ctx.log.info('Processing TokensSold event')
              const sellTrade = await handleTokensSold(ctx, log, timestamp, blockNumber)
              if (sellTrade) {
                personasToUpdate.add(sellTrade.persona.id)
                datesToUpdate.add(getDateString(timestamp))
                ctx.log.debug(`Sell trade recorded for persona ${sellTrade.persona.id}`)
              }
              break

            case factoryAbi.events.MetadataUpdated.topic:
              ctx.log.info('Processing MetadataUpdated event')
              await handleMetadataUpdated(ctx, log, timestamp, blockNumber)
              break
              
            case factoryAbi.events.V4PoolCreated.topic:
              ctx.log.info('Processing V4PoolCreated event')
              await handleV4PoolCreated(ctx, log, timestamp, blockNumber)
              const v4PoolEvent = factoryAbi.events.V4PoolCreated.decode(log)
              personasToUpdate.add(v4PoolEvent.tokenId.toString())
              break

            case factoryAbi.events.FeesCollected.topic:
              ctx.log.info('Processing FeesCollected event')
              await handleFeesCollected(ctx, log, timestamp, blockNumber)
              break

            case factoryAbi.events.Graduated.topic:
              ctx.log.info('Processing Graduated event')
              await handleGraduated(ctx, log, timestamp, blockNumber)
              const graduatedEvent = factoryAbi.events.Graduated.decode(log)
              personasToUpdate.add(graduatedEvent.tokenId.toString())
              break

            case factoryAbi.events.TokensClaimed.topic:
              ctx.log.info('Processing TokensClaimed event')
              await handleTokensClaimed(ctx, log, timestamp, blockNumber)
              break

            case factoryAbi.events.TokensDistributed.topic:
              ctx.log.info('Processing TokensDistributed event')
              await handleTokensDistributed(ctx, log, timestamp, blockNumber)
              break
              
            case factoryAbi.events.AgentTokenAssociated.topic:
              ctx.log.info('Processing AgentTokenAssociated event')
              await handleAgentTokenAssociated(ctx, log)
              break
              
            case factoryAbi.events.AgentTokensDeposited.topic:
              ctx.log.info('Processing AgentTokensDeposited event')
              await handleAgentTokensDeposited(ctx, log, timestamp, blockNumber)
              break
              
            case factoryAbi.events.AgentTokensWithdrawn.topic:
              ctx.log.info('Processing AgentTokensWithdrawn event')
              await handleAgentTokensWithdrawn(ctx, log)
              break
              
            case factoryAbi.events.AgentRewardsDistributed.topic:
              ctx.log.info('Processing AgentRewardsDistributed event')
              await handleAgentRewardsDistributed(ctx, log, timestamp, blockNumber)
              break

            case factoryAbi.events.PairingConfigUpdated.topic:
              ctx.log.info('Processing PairingConfigUpdated event')
              await handlePairingConfigUpdated(ctx, log, timestamp)
              break
              
            default:
              ctx.log.warn(`Unknown PersonaFactory event topic: ${topic}`)
          }
        }

        // BridgeWrapper events
        else if (address === DEPLOYMENT.addresses.bridgeWrapper) {
          eventsProcessed.bridgeWrapper++
          const topic = log.topics[0]
          ctx.log.debug(`BridgeWrapper event: ${topic} at block ${blockNumber}`)

          switch (topic) {
            case bridgeAbi.events.TokensWrapped.topic:
              ctx.log.info('Processing TokensWrapped event')
              await handleTokensWrapped(ctx, log, timestamp, blockNumber)
              datesToUpdate.add(getDateString(timestamp))
              break

            case bridgeAbi.events.TokensUnwrapped.topic:
              ctx.log.info('Processing TokensUnwrapped event')
              await handleTokensUnwrapped(ctx, log, timestamp, blockNumber)
              datesToUpdate.add(getDateString(timestamp))
              break

            case bridgeAbi.events.EmergencyWithdraw.topic:
              ctx.log.info('Processing EmergencyWithdraw event')
              await handleEmergencyWithdraw(ctx, log, timestamp, blockNumber)
              break

            case bridgeAbi.events.BridgeMetricsUpdated.topic:
              ctx.log.info('Processing BridgeMetricsUpdated event')
              await handleBridgeMetricsUpdated(ctx, log, timestamp, blockNumber)
              break

            case bridgeAbi.events.BridgeTokensUpdated.topic:
              ctx.log.info('Processing BridgeTokensUpdated event')
              await handleBridgeTokensUpdated(ctx, log, timestamp, blockNumber)
              break

            default:
              ctx.log.warn(`Unknown BridgeWrapper event topic: ${topic}`)
          }
        }

        // AmicaToken events
        else if (address === DEPLOYMENT.addresses.amicaToken) {
          eventsProcessed.amicaToken++
          const topic = log.topics[0]
          ctx.log.debug(`AmicaToken event: ${topic} at block ${blockNumber}`)

          switch (topic) {
            case amicaAbi.events.Transfer.topic:
              ctx.log.info('Processing AMICA Transfer event')
              await handleAmicaTransfer(ctx, log, timestamp, blockNumber)
              break

            case amicaAbi.events.TokenClaimed.topic:
              ctx.log.info('Processing AMICA TokenClaimed event')
              await handleAmicaTokenClaimed(ctx, log, timestamp, blockNumber)
              break

            case amicaAbi.events.TokenDeposited.topic:
              ctx.log.info('Processing AMICA TokenDeposited event')
              await handleAmicaTokenDeposited(ctx, log, timestamp, blockNumber)
              break

            case amicaAbi.events.TokenConfigured.topic:
              ctx.log.info('Processing AMICA TokenConfigured event')
              await handleAmicaTokenConfigured(ctx, log, timestamp, blockNumber)
              break

            case amicaAbi.events.TokenWithdrawn.topic:
              ctx.log.info('Processing AMICA TokenWithdrawn event')
              await handleAmicaTokenWithdrawn(ctx, log, timestamp, blockNumber)
              break

            default:
              ctx.log.warn(`Unknown AmicaToken event topic: ${topic}`)
          }
        }
        
      } catch (error) {
        eventsProcessed.errors++
        ctx.log.error(`Error processing log at block ${block.header.height}: ${error}`)
        ctx.log.error(`Log details: address=${address}, topics=${JSON.stringify(log.topics)}`)
        
        // Log the full error stack in debug mode
        if (error instanceof Error) {
          ctx.log.debug(`Error stack: ${error.stack}`)
        }
      }
    }
  }
  
  // Log batch processing summary
  ctx.log.info(`Batch processing complete:`)
  ctx.log.info(`  - Total logs: ${totalLogsProcessed}`)
  ctx.log.info(`  - PersonaFactory events: ${eventsProcessed.personaFactory}`)
  ctx.log.info(`  - BridgeWrapper events: ${eventsProcessed.bridgeWrapper}`)
  ctx.log.info(`  - AmicaToken events: ${eventsProcessed.amicaToken}`)
  ctx.log.info(`  - Errors: ${eventsProcessed.errors}`)
  
  // Update statistics
  if (blocks.size > 0) {
    ctx.log.info('Updating global statistics...')
    try {
      await updateGlobalStats(ctx)
      ctx.log.debug('Global statistics updated successfully')
    } catch (error) {
      ctx.log.error(`Failed to update global statistics: ${error}`)
    }
    
    ctx.log.info(`Updating daily statistics for ${datesToUpdate.size} dates...`)
    for (const dateStr of datesToUpdate) {
      try {
        await updateDailyStats(ctx, dateStr)
        ctx.log.debug(`Daily statistics updated for ${dateStr}`)
      } catch (error) {
        ctx.log.error(`Failed to update daily statistics for ${dateStr}: ${error}`)
      }
    }
    
    ctx.log.info(`Updating persona daily statistics for ${personasToUpdate.size} personas...`)
    for (const personaId of personasToUpdate) {
      try {
        await updatePersonaDailyStats(ctx, personaId, Array.from(datesToUpdate))
        ctx.log.debug(`Persona daily statistics updated for ${personaId}`)
      } catch (error) {
        ctx.log.error(`Failed to update persona daily statistics for ${personaId}: ${error}`)
      }
    }
  } else {
    ctx.log.warn('No blocks processed in this batch')
  }
  
  ctx.log.info('Batch processing finished')
})

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

async function updatePersonaDailyStats(ctx: Context, personaId: string, dates: string[]) {
  ctx.log.debug(`Updating persona daily stats for ${personaId} on ${dates.length} dates`)

  const persona = await ctx.store.get(Persona, personaId)
  if (!persona) {
    ctx.log.warn(`Persona ${personaId} not found for daily stats update`)
    return
  }

  for (const dateStr of dates) {
    const id = `${personaId}-${dateStr}`
    let stats = await ctx.store.get(PersonaDailyStats, id)

    if (!stats) {
      stats = new PersonaDailyStats({
        id,
        persona,
        date: new Date(dateStr),
        trades: 0,
        buyTrades: 0,
        sellTrades: 0,
        volume: 0n,
        buyVolume: 0n,
        sellVolume: 0n,
        uniqueTraders: 0,
      })
      ctx.log.trace(`Created new PersonaDailyStats for ${id}`)
    }

    // Get trades for this persona on this date
    const startOfDay = new Date(dateStr)
    const endOfDay = new Date(dateStr)
    endOfDay.setDate(endOfDay.getDate() + 1)

    try {
      const trades = await ctx.store.find(Trade, {
        where: {
          persona: { id: personaId },
          timestamp: Between(startOfDay, endOfDay)
        }
      })

      stats.trades = trades.length

      // Separate buy and sell trades
      const buyTrades = trades.filter(t => t.isBuy)
      const sellTrades = trades.filter(t => !t.isBuy)

      stats.buyTrades = buyTrades.length
      stats.sellTrades = sellTrades.length

      // Calculate volumes
      stats.buyVolume = buyTrades.reduce((sum, t) => sum + t.amountIn, 0n)
      stats.sellVolume = sellTrades.reduce((sum, t) => sum + t.amountOut, 0n)
      stats.volume = stats.buyVolume + stats.sellVolume

      stats.uniqueTraders = new Set(trades.map(t => t.trader)).size

      await ctx.store.save(stats)
      ctx.log.trace(`Saved PersonaDailyStats for ${id}: ${stats.trades} trades (${stats.buyTrades} buys, ${stats.sellTrades} sells), ${stats.volume} volume`)
    } catch (error) {
      ctx.log.error(`Failed to query trades for persona ${personaId} on ${dateStr}: ${error}`)
    }
  }
}
