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

processor.run(new TypeormDatabase({ supportHotBlocks: true }), async (ctx) => {
  const blocks: Set<number> = new Set()
  const personasToUpdate: Set<string> = new Set()
  const datesToUpdate: Set<string> = new Set()

  // Process all events
  for (let block of ctx.blocks) {
    blocks.add(block.header.height)
    
    for (let log of block.logs) {
      if (!log.address) continue
      
      const address = log.address.toLowerCase()
      const timestamp = new Date(block.header.timestamp)
      const blockNumber = BigInt(block.header.height)
      
      try {
        // PersonaTokenFactory events
        if (address === DEPLOYMENT.addresses.personaFactory) {
          switch (log.topics[0]) {
            case factoryAbi.events.PersonaCreated.topic:
              await handlePersonaCreated(ctx, log, timestamp, blockNumber)
              break
              
            case factoryAbi.events.TokensPurchased.topic:
              const trade = await handleTokensPurchased(ctx, log, timestamp, blockNumber)
              if (trade) {
                personasToUpdate.add(trade.persona.id)
                datesToUpdate.add(getDateString(timestamp))
              }
              break
              
            case factoryAbi.events.MetadataUpdated.topic:
              await handleMetadataUpdated(ctx, log, timestamp, blockNumber)
              break
              
            case factoryAbi.events.LiquidityPairCreated.topic:
              await handleLiquidityPairCreated(ctx, log)
              break
              
            case factoryAbi.events.TradingFeesCollected.topic:
              await handleTradingFeesCollected(ctx, log)
              break
              
            case factoryAbi.events.FeeReductionConfigUpdated.topic:
              await handleFeeReductionConfigUpdated(ctx, log, timestamp)
              break
              
            case factoryAbi.events.TradingFeeConfigUpdated.topic:
              await handleTradingFeeConfigUpdated(ctx, log, timestamp)
              break
              
            case factoryAbi.events.SnapshotUpdated.topic:
              await handleSnapshotUpdated(ctx, log, timestamp)
              break
              
            case factoryAbi.events.AgentTokenAssociated.topic:
              await handleAgentTokenAssociated(ctx, log)
              break
              
            case factoryAbi.events.AgentTokensDeposited.topic:
              await handleAgentTokensDeposited(ctx, log, timestamp, blockNumber)
              break
              
            case factoryAbi.events.AgentTokensWithdrawn.topic:
              await handleAgentTokensWithdrawn(ctx, log)
              break
              
            case factoryAbi.events.AgentRewardsDistributed.topic:
              await handleAgentRewardsDistributed(ctx, log, timestamp, blockNumber)
              break
          }
        }
        
        // StakingRewards events
        else if (address === DEPLOYMENT.addresses.stakingRewards) {
          switch (log.topics[0]) {
            case stakingAbi.events.PoolAdded.topic:
              await handlePoolAdded(ctx, log, timestamp, blockNumber)
              break
              
            case stakingAbi.events.PoolUpdated.topic:
              await handlePoolUpdated(ctx, log)
              break
              
            case stakingAbi.events.Deposit.topic:
              await handleStakingDeposit(ctx, log, timestamp)
              break
              
            case stakingAbi.events.DepositLocked.topic:
              await handleStakingDepositLocked(ctx, log, timestamp, blockNumber)
              break
              
            case stakingAbi.events.Withdraw.topic:
              await handleStakingWithdraw(ctx, log)
              break
              
            case stakingAbi.events.WithdrawLocked.topic:
              await handleStakingWithdrawLocked(ctx, log)
              break
              
            case stakingAbi.events.RewardsClaimed.topic:
              await handleRewardsClaimed(ctx, log, timestamp, blockNumber)
              break
          }
        }
        
        // BridgeWrapper events
        else if (address === DEPLOYMENT.addresses.bridgeWrapper) {
          switch (log.topics[0]) {
            case bridgeAbi.events.TokensWrapped.topic:
              await handleTokensWrapped(ctx, log, timestamp, blockNumber)
              datesToUpdate.add(getDateString(timestamp))
              break
              
            case bridgeAbi.events.TokensUnwrapped.topic:
              await handleTokensUnwrapped(ctx, log, timestamp, blockNumber)
              datesToUpdate.add(getDateString(timestamp))
              break
          }
        }
      } catch (error) {
        ctx.log.error(`Error processing log at block ${block.header.height}: ${error}`)
      }
    }
  }
  
  // Update statistics
  if (blocks.size > 0) {
    await updateGlobalStats(ctx)
    
    for (const dateStr of datesToUpdate) {
      await updateDailyStats(ctx, dateStr)
    }
    
    for (const personaId of personasToUpdate) {
      await updatePersonaDailyStats(ctx, personaId, Array.from(datesToUpdate))
    }
  }
})

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

async function updatePersonaDailyStats(ctx: Context, personaId: string, dates: string[]) {
  const persona = await ctx.store.get(Persona, personaId)
  if (!persona) return
  
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
    }
    
    // Get trades for this persona on this date
    const startOfDay = new Date(dateStr)
    const endOfDay = new Date(dateStr)
    endOfDay.setDate(endOfDay.getDate() + 1)
    
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
  }
}
