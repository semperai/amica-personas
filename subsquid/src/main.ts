import { TypeormDatabase } from '@subsquid/typeorm-store'
import { processor, Context, Log, DEPLOYMENT } from './processor'
import * as factoryAbi from './abi/PersonaTokenFactory'
import * as stakingAbi from './abi/PersonaStakingRewards'
import * as bridgeAbi from './abi/AmicaBridgeWrapper'
import * as amicaAbi from './abi/AmicaToken'
import {
  Persona,
  PersonaMetadata,
  Trade,
  AgentDeposit,
  AgentReward,
  StakingPool,
  UserStake,
  StakeLock,
  StakingRewardClaim,
  BridgeActivity,
  BridgeAction,
  FeeConfig,
  UserSnapshot,
  GlobalStats,
  DailyStats,
  PersonaDailyStats,
} from './model'
import { And, In, MoreThanOrEqual, LessThan, Between } from 'typeorm'

// Event handlers
import { handlePersonaCreated } from './handlers/persona'
import { handleTokensPurchased, handleTradingFeesCollected } from './handlers/trading'
import { handleMetadataUpdated } from './handlers/metadata'
import { handleLiquidityPairCreated } from './handlers/liquidity'
import { 
  handleFeeReductionConfigUpdated, 
  handleTradingFeeConfigUpdated,
  handleSnapshotUpdated 
} from './handlers/fees'
import {
  handleAgentTokenAssociated,
  handleAgentTokensDeposited,
  handleAgentTokensWithdrawn,
  handleAgentRewardsDistributed
} from './handlers/agent'
import {
  handlePoolAdded,
  handlePoolUpdated,
  handleStakingDeposit,
  handleStakingDepositLocked,
  handleStakingWithdraw,
  handleStakingWithdrawLocked,
  handleRewardsClaimed
} from './handlers/staking'
import { handleTokensWrapped, handleTokensUnwrapped } from './handlers/bridge'
import { updateGlobalStats, updateDailyStats } from './handlers/stats'

// Log startup information
console.log('=== SUBSQUID PROCESSOR STARTING ===')
console.log(`Chain: ${DEPLOYMENT.chainName} (${DEPLOYMENT.chainId})`)
console.log(`Start Block: ${DEPLOYMENT.startBlock}`)
console.log('Addresses:')
console.log(`  - PersonaFactory: ${DEPLOYMENT.addresses.personaFactory}`)
console.log(`  - StakingRewards: ${DEPLOYMENT.addresses.stakingRewards}`)
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
    stakingRewards: 0,
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
              
            case factoryAbi.events.TokensPurchased.topic:
              ctx.log.info('Processing TokensPurchased event')
              const trade = await handleTokensPurchased(ctx, log, timestamp, blockNumber)
              if (trade) {
                personasToUpdate.add(trade.persona.id)
                datesToUpdate.add(getDateString(timestamp))
                ctx.log.debug(`Trade recorded for persona ${trade.persona.id}`)
              }
              break
              
            case factoryAbi.events.MetadataUpdated.topic:
              ctx.log.info('Processing MetadataUpdated event')
              await handleMetadataUpdated(ctx, log, timestamp, blockNumber)
              break
              
            case factoryAbi.events.LiquidityPairCreated.topic:
              ctx.log.info('Processing LiquidityPairCreated event')
              await handleLiquidityPairCreated(ctx, log)
              break
              
            case factoryAbi.events.TradingFeesCollected.topic:
              ctx.log.info('Processing TradingFeesCollected event')
              await handleTradingFeesCollected(ctx, log)
              break
              
            case factoryAbi.events.FeeReductionConfigUpdated.topic:
              ctx.log.info('Processing FeeReductionConfigUpdated event')
              await handleFeeReductionConfigUpdated(ctx, log, timestamp)
              break
              
            case factoryAbi.events.TradingFeeConfigUpdated.topic:
              ctx.log.info('Processing TradingFeeConfigUpdated event')
              await handleTradingFeeConfigUpdated(ctx, log, timestamp)
              break
              
            case factoryAbi.events.SnapshotUpdated.topic:
              ctx.log.info('Processing SnapshotUpdated event')
              await handleSnapshotUpdated(ctx, log, timestamp)
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
              
            default:
              ctx.log.warn(`Unknown PersonaFactory event topic: ${topic}`)
          }
        }
        
        // StakingRewards events
        else if (address === DEPLOYMENT.addresses.stakingRewards) {
          eventsProcessed.stakingRewards++
          const topic = log.topics[0]
          ctx.log.debug(`StakingRewards event: ${topic} at block ${blockNumber}`)
          
          switch (topic) {
            case stakingAbi.events.PoolAdded.topic:
              ctx.log.info('Processing PoolAdded event')
              await handlePoolAdded(ctx, log, timestamp, blockNumber)
              break
              
            case stakingAbi.events.PoolUpdated.topic:
              ctx.log.info('Processing PoolUpdated event')
              await handlePoolUpdated(ctx, log)
              break
              
            case stakingAbi.events.Deposit.topic:
              ctx.log.info('Processing Deposit event')
              await handleStakingDeposit(ctx, log, timestamp)
              break
              
            case stakingAbi.events.DepositLocked.topic:
              ctx.log.info('Processing DepositLocked event')
              await handleStakingDepositLocked(ctx, log, timestamp, blockNumber)
              break
              
            case stakingAbi.events.Withdraw.topic:
              ctx.log.info('Processing Withdraw event')
              await handleStakingWithdraw(ctx, log)
              break
              
            case stakingAbi.events.WithdrawLocked.topic:
              ctx.log.info('Processing WithdrawLocked event')
              await handleStakingWithdrawLocked(ctx, log)
              break
              
            case stakingAbi.events.RewardsClaimed.topic:
              ctx.log.info('Processing RewardsClaimed event')
              await handleRewardsClaimed(ctx, log, timestamp, blockNumber)
              break
              
            default:
              ctx.log.warn(`Unknown StakingRewards event topic: ${topic}`)
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
              
            default:
              ctx.log.warn(`Unknown BridgeWrapper event topic: ${topic}`)
          }
        }
        
        // AmicaToken events
        else if (address === DEPLOYMENT.addresses.amicaToken) {
          eventsProcessed.amicaToken++
          ctx.log.debug(`AmicaToken event at block ${blockNumber}`)
          // Handle AmicaToken events if needed
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
  ctx.log.info(`  - StakingRewards events: ${eventsProcessed.stakingRewards}`)
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
        volume: 0n,
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
          timestamp: And(
            MoreThanOrEqual(startOfDay),
            LessThan(endOfDay)
          )
        }
      })
      
      stats.trades = trades.length
      stats.volume = trades.reduce((sum, t) => sum + t.amountIn, 0n)
      stats.uniqueTraders = new Set(trades.map(t => t.trader)).size
      
      await ctx.store.save(stats)
      ctx.log.trace(`Saved PersonaDailyStats for ${id}: ${stats.trades} trades, ${stats.volume} volume`)
    } catch (error) {
      ctx.log.error(`Failed to query trades for persona ${personaId} on ${dateStr}: ${error}`)
    }
  }
}
