// src/processors/base.processor.ts
import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor'
import { Store, TypeormDatabase } from '@subsquid/typeorm-store'
import { MoreThanOrEqual } from 'typeorm'
import { ethers } from 'ethers'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import * as amicaAbi from '../abi/AmicaToken'
import * as wrapperAbi from '../abi/AmicaBridgeWrapper'
import * as stakingAbi from '../abi/PersonaStakingRewards'
import { 
  Chain, 
  Persona, 
  Metadata, 
  Trade, 
  DailyVolume,
  BridgeActivity,
  BridgeAction,
  AmicaTokenDeposit,
  AgentDeposit,
  AgentReward,
  FeeSnapshot,
  FeeReductionConfig,
  StakingPool,
  UserStake,
  StakeLock,
  StakingRewardClaim
} from '../model'
import { ChainConfig, formatChainEntityId } from '../config/chains'

export type Fields = EvmBatchProcessorFields<typeof createProcessor>
export type Context = DataHandlerContext<Store, Fields>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>

function createProcessor() {
  return new EvmBatchProcessor()
    .setFields({
      transaction: {
        from: true,
        value: true,
        hash: true,
      },
      log: {
        topics: true,
        data: true,
        transactionHash: true,
      }
    })
}

export abstract class BaseChainProcessor {
  protected processor: EvmBatchProcessor<Fields>
  protected config: ChainConfig
  protected chain?: Chain
  
  // Contract interfaces
  protected FACTORY_INTERFACE = new ethers.Interface([
    'function personas(uint256) view returns (string name, string symbol, address erc20Token, address pairToken, address agentToken, bool pairCreated, uint256 createdAt, uint256 totalAgentDeposited, uint256 minAgentTokens)',
    'function purchases(uint256) view returns (uint256 totalDeposited, uint256 tokensSold)',
    'function pairingConfigs(address) view returns (bool enabled, uint256 mintCost, uint256 graduationThreshold)',
    'function getMetadata(uint256 tokenId, string[] keys) view returns (string[])',
    'function tradingFeeConfig() view returns (uint256 feePercentage, uint256 creatorShare)',
    'function feeReductionConfig() view returns (uint256 minAmicaForReduction, uint256 maxAmicaForReduction, uint256 minReductionMultiplier, uint256 maxReductionMultiplier)',
    'function userSnapshots(address) view returns (uint256 currentBalance, uint256 currentBlock, uint256 pendingBalance, uint256 pendingBlock)',
    'function getEffectiveFeePercentage(address user) view returns (uint256)',
    'function stakingRewards() view returns (address)'
  ])
  
  protected STAKING_INTERFACE = new ethers.Interface([
    'function poolInfo(uint256) view returns (address lpToken, uint256 allocBasisPoints, uint256 lastRewardBlock, uint256 accAmicaPerShare, uint256 totalStaked, bool isAgentPool, uint256 personaTokenId, bool isActive)',
    'function poolWeightedTotal(uint256) view returns (uint256)'
  ])
  
  constructor(config: ChainConfig) {
    this.config = config
    this.processor = this.createProcessor()
  }
  
  private createProcessor() {
    const processor = createProcessor()
      .setDataSource({
        archive: this.config.archive,
        chain: {
          url: this.config.rpcUrl,
          rateLimit: 10
        }
      })
      .setFinalityConfirmation(75)
      .setBlockRange({
        from: this.config.deploymentBlock,
      })
    
    // Add PersonaTokenFactory events
    processor.addLog({
      address: [this.config.factoryAddress],
      topic0: [
        factoryAbi.events.PersonaCreated.topic,
        factoryAbi.events.TokensPurchased.topic,
        factoryAbi.events.MetadataUpdated.topic,
        factoryAbi.events.LiquidityPairCreated.topic,
        factoryAbi.events.TradingFeesCollected.topic,
        factoryAbi.events.AgentTokenAssociated.topic,
        factoryAbi.events.AgentTokensDeposited.topic,
        factoryAbi.events.AgentTokensWithdrawn.topic,
        factoryAbi.events.AgentRewardsDistributed.topic,
        factoryAbi.events.FeeReductionConfigUpdated.topic,
        factoryAbi.events.SnapshotUpdated.topic,
        factoryAbi.events.StakingRewardsSet.topic,
        factoryAbi.events.TokensWithdrawn.topic,
        factoryAbi.events.TradingFeeConfigUpdated.topic,
      ]
    })
    
    // Add AmicaToken events
    processor.addLog({
      address: [this.config.amicaToken],
      topic0: [
        amicaAbi.events.TokensDeposited.topic,
        amicaAbi.events.TokensBurnedAndClaimed.topic,
      ]
    })
    
    // Add bridge wrapper events if not mainnet
    if (this.config.bridgeWrapperAddress) {
      processor.addLog({
        address: [this.config.bridgeWrapperAddress],
        topic0: [
          wrapperAbi.events.TokensWrapped.topic,
          wrapperAbi.events.TokensUnwrapped.topic,
        ]
      })
    }
    
    // Add staking events if address is configured
    if (this.config.stakingRewardsAddress) {
      processor.addLog({
        address: [this.config.stakingRewardsAddress],
        topic0: [
          stakingAbi.events.PoolAdded.topic,
          stakingAbi.events.PoolUpdated.topic,
          stakingAbi.events.Deposit.topic,
          stakingAbi.events.DepositLocked.topic,
          stakingAbi.events.Withdraw.topic,
          stakingAbi.events.WithdrawLocked.topic,
          stakingAbi.events.RewardsClaimed.topic,
        ]
      })
    }
    
    return processor
  }
  
  async process(database: TypeormDatabase) {
    await this.processor.run(database, async (ctx) => {
      // Initialize chain entity if needed
      if (!this.chain) {
        this.chain = await this.getOrCreateChain(ctx)
      }
      
      // Process blocks
      await this.processBlocks(ctx)
    })
  }
  
  private async getOrCreateChain(ctx: Context): Promise<Chain> {
    let chain = await ctx.store.get(Chain, this.config.id.toString())
    
    if (!chain) {
      chain = new Chain({
        id: this.config.id.toString(),
        name: this.config.name,
        amicaToken: this.config.amicaToken.toLowerCase(),
        factoryAddress: this.config.factoryAddress.toLowerCase(),
        bridgeWrapperAddress: this.config.bridgeWrapperAddress?.toLowerCase(),
        stakingRewardsAddress: this.config.stakingRewardsAddress?.toLowerCase(),
        totalPersonas: 0,
        totalVolume: 0n
      })
      await ctx.store.insert(chain)
    }
    
    return chain
  }
  
  private async processBlocks(ctx: Context) {
    const personas: Map<string, Persona> = new Map()
    const metadata: Map<string, Metadata> = new Map()
    const trades: Trade[] = []
    const dailyVolumes: Map<string, DailyVolume> = new Map()
    const bridgeActivities: BridgeActivity[] = []
    const amicaDeposits: AmicaTokenDeposit[] = []
    const agentDeposits: AgentDeposit[] = []
    const agentRewards: AgentReward[] = []
    const feeSnapshots: Map<string, FeeSnapshot> = new Map()
    const stakingPools: Map<string, StakingPool> = new Map()
    const userStakes: Map<string, UserStake> = new Map()
    const stakeLocks: StakeLock[] = []
    const rewardClaims: StakingRewardClaim[] = []
    
    for (const block of ctx.blocks) {
      for (const log of block.logs) {
        const timestamp = new Date(block.header.timestamp)
        
        // Handle PersonaTokenFactory events
        if (log.address.toLowerCase() === this.config.factoryAddress.toLowerCase()) {
          await this.handleFactoryEvent(
            ctx, log, block.header, timestamp,
            personas, metadata, trades, dailyVolumes,
            agentDeposits, agentRewards, feeSnapshots
          )
        }
        
        // Handle AmicaToken events
        else if (log.address.toLowerCase() === this.config.amicaToken.toLowerCase()) {
          await this.handleAmicaTokenEvent(
            ctx, log, block.header, timestamp,
            amicaDeposits
          )
        }
        
        // Handle bridge wrapper events
        else if (
          this.config.bridgeWrapperAddress &&
          log.address.toLowerCase() === this.config.bridgeWrapperAddress.toLowerCase()
        ) {
          await this.handleBridgeWrapperEvent(
            ctx, log, block.header, timestamp,
            bridgeActivities
          )
        }
        
        // Handle staking events
        else if (
          this.config.stakingRewardsAddress &&
          log.address.toLowerCase() === this.config.stakingRewardsAddress.toLowerCase()
        ) {
          await this.handleStakingEvent(
            ctx, log, block.header, timestamp,
            stakingPools, userStakes, stakeLocks, rewardClaims
          )
        }
      }
    }
    
    // Save all entities
    await this.saveEntities(
      ctx,
      personas,
      metadata,
      trades,
      dailyVolumes,
      bridgeActivities,
      amicaDeposits,
      agentDeposits,
      agentRewards,
      feeSnapshots,
      stakingPools,
      userStakes,
      stakeLocks,
      rewardClaims
    )
  }
  
  private async handleFactoryEvent(
    ctx: Context,
    log: Log,
    block: BlockHeader<Fields>,
    timestamp: Date,
    personas: Map<string, Persona>,
    metadata: Map<string, Metadata>,
    trades: Trade[],
    dailyVolumes: Map<string, DailyVolume>,
    agentDeposits: AgentDeposit[],
    agentRewards: AgentReward[],
    feeSnapshots: Map<string, FeeSnapshot>
  ) {
    // Handle PersonaCreated
    if (log.topics[0] === factoryAbi.events.PersonaCreated.topic) {
      const event = factoryAbi.events.PersonaCreated.decode(log)
      const tokenId = event.tokenId.toString()
      const personaId = formatChainEntityId(this.config.id, tokenId)
      
      // Get full state from contract
      const state = await this.getPersonaState(ctx, tokenId)
      
      const persona = new Persona({
        id: personaId,
        chain: this.chain!,
        tokenId: event.tokenId,
        creator: event.creator.toLowerCase(),
        name: state.name,
        symbol: state.symbol,
        erc20Token: state.erc20Token,
        pairToken: state.pairToken,
        agentToken: state.agentToken,
        minAgentTokens: state.minAgentTokens || 0n,
        totalAgentDeposited: 0n,
        pairCreated: state.pairCreated,
        createdAt: timestamp,
        createdAtBlock: BigInt(block.height),
        totalVolume24h: 0n,
        totalVolumeAllTime: 0n,
        totalTrades24h: 0,
        totalTradesAllTime: 0,
        uniqueTraders24h: 0,
        uniqueTradersAllTime: 0,
        averageFeeRate: 0n,
        totalDeposited: state.totalDeposited,
        tokensSold: state.tokensSold,
        graduationThreshold: state.graduationThreshold,
        isGraduated: false
      })
      
      personas.set(persona.id, persona)
      
      // Update chain stats
      this.chain!.totalPersonas += 1
      
      ctx.log.info(`Created persona ${personaId}: ${state.name} (${state.symbol}) on ${this.config.name}`)
    }
    
    // Handle TokensPurchased
    else if (log.topics[0] === factoryAbi.events.TokensPurchased.topic) {
      const event = factoryAbi.events.TokensPurchased.decode(log)
      const tokenId = event.tokenId.toString()
      const personaId = formatChainEntityId(this.config.id, tokenId)
      const trader = event.buyer.toLowerCase()
      
      // Get or load persona
      let persona = personas.get(personaId)
      if (!persona) {
        persona = await ctx.store.get(Persona, personaId)
        if (!persona) {
          ctx.log.warn(`Persona ${personaId} not found for trade`)
          return
        }
        personas.set(personaId, persona)
      }
      
      // Calculate effective fee
      const baseFeeAmount = await this.calculateBaseFeeAmount(ctx, event.amountSpent)
      const effectiveFeeAmount = await this.calculateEffectiveFee(ctx, trader, baseFeeAmount)
      const effectiveFeeRate = Number((effectiveFeeAmount * 10000n) / event.amountSpent)
      
      // Create trade record
      const tradeId = formatChainEntityId(
        this.config.id,
        `${log.transactionHash}-${log.logIndex}`
      )
      
      const trade = new Trade({
        id: tradeId,
        chain: this.chain!,
        persona,
        trader,
        amountIn: event.amountSpent,
        amountOut: event.tokensReceived,
        feeAmount: effectiveFeeAmount,
        effectiveFeeRate,
        timestamp,
        block: BigInt(block.height),
        txHash: log.transactionHash
      })
      trades.push(trade)
      
      // Update persona stats
      persona.totalVolumeAllTime += event.amountSpent
      persona.totalTradesAllTime += 1
      
      // Update average fee rate
      const totalFees = persona.averageFeeRate * BigInt(persona.totalTradesAllTime - 1) + BigInt(effectiveFeeRate)
      persona.averageFeeRate = totalFees / BigInt(persona.totalTradesAllTime)
      
      // Update chain volume
      this.chain!.totalVolume += event.amountSpent
      
      // Update daily volume
      await this.updateDailyVolume(
        ctx, persona, timestamp, event.amountSpent, trader, dailyVolumes
      )
      
      // Update 24h stats
      await this.update24hStats(ctx, persona, timestamp)
      
      ctx.log.info(`Trade on ${this.config.name}: ${trader} bought persona ${tokenId} with ${effectiveFeeRate} bps fee`)
    }
    
    // Handle AgentTokenAssociated
    else if (log.topics[0] === factoryAbi.events.AgentTokenAssociated.topic) {
      const event = factoryAbi.events.AgentTokenAssociated.decode(log)
      const tokenId = event.tokenId.toString()
      const personaId = formatChainEntityId(this.config.id, tokenId)
      
      let persona = personas.get(personaId)
      if (!persona) {
        persona = await ctx.store.get(Persona, personaId)
        if (!persona) return
        personas.set(personaId, persona)
      }
      
      persona.agentToken = event.agentToken.toLowerCase()
      
      ctx.log.info(`Agent token ${event.agentToken} associated with persona ${tokenId}`)
    }
    
    // Handle AgentTokensDeposited
    else if (log.topics[0] === factoryAbi.events.AgentTokensDeposited.topic) {
      const event = factoryAbi.events.AgentTokensDeposited.decode(log)
      const tokenId = event.tokenId.toString()
      const personaId = formatChainEntityId(this.config.id, tokenId)
      
      // Get deposit index for unique ID
      const existingDeposits = await ctx.store.find(AgentDeposit, {
        where: {
          persona: { id: personaId },
          user: event.depositor.toLowerCase()
        }
      })
      
      const depositId = formatChainEntityId(
        this.config.id,
        `${tokenId}-${event.depositor}-${existingDeposits.length}`
      )
      
      const deposit = new AgentDeposit({
        id: depositId,
        chain: this.chain!,
        persona: { id: personaId } as Persona,
        user: event.depositor.toLowerCase(),
        amount: event.amount,
        timestamp,
        withdrawn: false,
        rewardsClaimed: false,
        block: BigInt(block.height),
        txHash: log.transactionHash
      })
      
      agentDeposits.push(deposit)
      
      // Update persona total
      let persona = personas.get(personaId)
      if (!persona) {
        persona = await ctx.store.get(Persona, personaId)
        if (!persona) return
        personas.set(personaId, persona)
      }
      
      persona.totalAgentDeposited += event.amount
    }
    
    // Handle AgentTokensWithdrawn
    else if (log.topics[0] === factoryAbi.events.AgentTokensWithdrawn.topic) {
      const event = factoryAbi.events.AgentTokensWithdrawn.decode(log)
      const tokenId = event.tokenId.toString()
      const personaId = formatChainEntityId(this.config.id, tokenId)
      
      // Mark deposits as withdrawn
      const deposits = await ctx.store.find(AgentDeposit, {
        where: {
          persona: { id: personaId },
          user: event.depositor.toLowerCase(),
          withdrawn: false
        }
      })
      
      let totalWithdrawn = 0n
      for (const deposit of deposits) {
        if (totalWithdrawn + deposit.amount <= event.amount) {
          deposit.withdrawn = true
          totalWithdrawn += deposit.amount
          await ctx.store.save(deposit)
        }
      }
      
      // Update persona total
      let persona = personas.get(personaId)
      if (!persona) {
        persona = await ctx.store.get(Persona, personaId)
        if (!persona) return
        personas.set(personaId, persona)
      }
      
      persona.totalAgentDeposited -= event.amount
    }
    
    // Handle AgentRewardsDistributed
    else if (log.topics[0] === factoryAbi.events.AgentRewardsDistributed.topic) {
      const event = factoryAbi.events.AgentRewardsDistributed.decode(log)
      const tokenId = event.tokenId.toString()
      const personaId = formatChainEntityId(this.config.id, tokenId)
      
      const rewardId = formatChainEntityId(
        this.config.id,
        `${log.transactionHash}-${log.logIndex}`
      )
      
      const reward = new AgentReward({
        id: rewardId,
        chain: this.chain!,
        persona: { id: personaId } as Persona,
        user: event.recipient.toLowerCase(),
        personaTokensReceived: event.personaTokens,
        agentTokenAmount: event.agentShare,
        timestamp,
        block: BigInt(block.height),
        txHash: log.transactionHash
      })
      
      agentRewards.push(reward)
      
      // Mark deposits as claimed
      const deposits = await ctx.store.find(AgentDeposit, {
        where: {
          persona: { id: personaId },
          user: event.recipient.toLowerCase(),
          rewardsClaimed: false
        }
      })
      
      for (const deposit of deposits) {
        deposit.rewardsClaimed = true
        await ctx.store.save(deposit)
      }
    }
    
    // Handle FeeReductionConfigUpdated
    else if (log.topics[0] === factoryAbi.events.FeeReductionConfigUpdated.topic) {
      const event = factoryAbi.events.FeeReductionConfigUpdated.decode(log)
      
      let feeConfig = await ctx.store.get(FeeReductionConfig, this.config.id.toString())
      if (!feeConfig) {
        feeConfig = new FeeReductionConfig({
          id: this.config.id.toString(),
          chain: this.chain!,
          minAmicaForReduction: 0n,
          maxAmicaForReduction: 0n,
          minReductionMultiplier: 10000,
          maxReductionMultiplier: 10000,
          baseFeePercentage: 100 // 1% default
        })
      }
      
      feeConfig.minAmicaForReduction = event.minAmicaForReduction
      feeConfig.maxAmicaForReduction = event.maxAmicaForReduction
      feeConfig.minReductionMultiplier = Number(event.minReductionMultiplier)
      feeConfig.maxReductionMultiplier = Number(event.maxReductionMultiplier)
      
      await ctx.store.upsert(feeConfig)
    }
    
    // Handle SnapshotUpdated
    else if (log.topics[0] === factoryAbi.events.SnapshotUpdated.topic) {
      const event = factoryAbi.events.SnapshotUpdated.decode(log)
      
      const snapshotId = formatChainEntityId(this.config.id, event.user)
      let snapshot = feeSnapshots.get(snapshotId)
      
      if (!snapshot) {
        snapshot = await ctx.store.get(FeeSnapshot, snapshotId)
        if (!snapshot) {
          snapshot = new FeeSnapshot({
            id: snapshotId,
            chain: this.chain!,
            user: event.user.toLowerCase(),
            currentBalance: 0n,
            currentBlock: 0n,
            lastUpdated: timestamp,
            isActive: false
          })
        }
        feeSnapshots.set(snapshotId, snapshot)
      }
      
      // Check if current pending should be promoted
      const currentBlock = BigInt(block.height)
      if (snapshot.pendingBlock && currentBlock >= snapshot.pendingBlock + 100n) {
        snapshot.currentBalance = snapshot.pendingBalance!
        snapshot.currentBlock = snapshot.pendingBlock
        snapshot.pendingBalance = undefined
        snapshot.pendingBlock = undefined
        snapshot.isActive = true
      }
      
      // Set new pending
      snapshot.pendingBalance = event.snapshotBalance
      snapshot.pendingBlock = event.blockNumber
      snapshot.lastUpdated = timestamp
    }
    
    // Handle StakingRewardsSet
    else if (log.topics[0] === factoryAbi.events.StakingRewardsSet.topic) {
      const event = factoryAbi.events.StakingRewardsSet.decode(log)
      this.chain!.stakingRewardsAddress = event.stakingRewards.toLowerCase()
    }
    
    // Handle MetadataUpdated
    else if (log.topics[0] === factoryAbi.events.MetadataUpdated.topic) {
      const event = factoryAbi.events.MetadataUpdated.decode(log)
      const tokenId = event.tokenId.toString()
      const personaId = formatChainEntityId(this.config.id, tokenId)
      const key = event.key
      
      // Get metadata value from contract
      const value = await this.getMetadataValue(ctx, tokenId, key)
      
      const metadataId = `${personaId}-${key}`
      const metadataItem = new Metadata({
        id: metadataId,
        persona: { id: personaId } as Persona,
        key,
        value,
        updatedAt: timestamp,
        updatedAtBlock: BigInt(block.height)
      })
      
      metadata.set(metadataId, metadataItem)
    }
    
    // Handle LiquidityPairCreated
    else if (log.topics[0] === factoryAbi.events.LiquidityPairCreated.topic) {
      const event = factoryAbi.events.LiquidityPairCreated.decode(log)
      const tokenId = event.tokenId.toString()
      const personaId = formatChainEntityId(this.config.id, tokenId)
      
      let persona = personas.get(personaId)
      if (!persona) {
        persona = await ctx.store.get(Persona, personaId)
        if (!persona) return
        personas.set(personaId, persona)
      }
      
      persona.pairCreated = true
      persona.pairAddress = event.pair.toLowerCase()
      persona.isGraduated = true
      
      ctx.log.info(`Persona ${tokenId} graduated on ${this.config.name} with pair ${event.pair}`)
    }
  }
  
  private async handleStakingEvent(
    ctx: Context,
    log: Log,
    block: BlockHeader<Fields>,
    timestamp: Date,
    stakingPools: Map<string, StakingPool>,
    userStakes: Map<string, UserStake>,
    stakeLocks: StakeLock[],
    rewardClaims: StakingRewardClaim[]
  ) {
    // Handle PoolAdded
    if (log.topics[0] === stakingAbi.events.PoolAdded.topic) {
      const event = stakingAbi.events.PoolAdded.decode(log)
      const poolId = formatChainEntityId(this.config.id, event.poolId.toString())
      
      const pool = new StakingPool({
        id: poolId,
        chain: this.chain!,
        poolId: Number(event.poolId),
        lpToken: event.lpToken.toLowerCase(),
        allocBasisPoints: Number(event.allocBasisPoints),
        isAgentPool: event.isAgentPool,
        personaTokenId: event.isAgentPool ? event.poolId : undefined,
        isActive: true,
        totalStaked: 0n,
        weightedTotal: 0n,
        accAmicaPerShare: 0n,
        lastRewardBlock: BigInt(block.height),
        createdAt: timestamp,
        createdAtBlock: BigInt(block.height)
      })
      
      stakingPools.set(poolId, pool)
    }
    
    // Handle PoolUpdated
    else if (log.topics[0] === stakingAbi.events.PoolUpdated.topic) {
      const event = stakingAbi.events.PoolUpdated.decode(log)
      const poolId = formatChainEntityId(this.config.id, event.poolId.toString())
      
      let pool = stakingPools.get(poolId)
      if (!pool) {
        pool = await ctx.store.get(StakingPool, poolId)
        if (!pool) return
        stakingPools.set(poolId, pool)
      }
      
      pool.allocBasisPoints = Number(event.allocBasisPoints)
      pool.isActive = event.isActive
    }
    
    // Handle Deposit
    else if (log.topics[0] === stakingAbi.events.Deposit.topic) {
      const event = stakingAbi.events.Deposit.decode(log)
      const poolId = formatChainEntityId(this.config.id, event.poolId.toString())
      const userStakeId = `${poolId}-${event.user.toLowerCase()}`
      
      let userStake = userStakes.get(userStakeId)
      if (!userStake) {
        userStake = await ctx.store.get(UserStake, userStakeId)
        if (!userStake) {
          userStake = new UserStake({
            id: userStakeId,
            pool: { id: poolId } as StakingPool,
            user: event.user.toLowerCase(),
            flexibleAmount: 0n,
            lockedAmount: 0n,
            weightedAmount: 0n,
            unclaimedRewards: 0n,
            firstStakeAt: timestamp,
            lastStakeAt: timestamp
          })
        }
        userStakes.set(userStakeId, userStake)
      }
      
      userStake.flexibleAmount += event.amount
      userStake.weightedAmount += event.amount
      userStake.lastStakeAt = timestamp
      
      // Update pool totals
      let pool = stakingPools.get(poolId)
      if (!pool) {
        pool = await ctx.store.get(StakingPool, poolId)
        if (!pool) return
        stakingPools.set(poolId, pool)
      }
      
      pool.totalStaked += event.amount
      pool.weightedTotal += event.amount
    }
    
    // Handle DepositLocked
    else if (log.topics[0] === stakingAbi.events.DepositLocked.topic) {
      const event = stakingAbi.events.DepositLocked.decode(log)
      const poolId = formatChainEntityId(this.config.id, event.poolId.toString())
      const userStakeId = `${poolId}-${event.user.toLowerCase()}`
      const lockId = formatChainEntityId(
        this.config.id,
        `${event.poolId}-${event.user}-${event.lockId}`
      )
      
      // Create lock record
      const lock = new StakeLock({
        id: lockId,
        userStake: { id: userStakeId } as UserStake,
        lockId: event.lockId,
        amount: event.amount,
        unlockTime: new Date(Number(event.unlockTime) * 1000),
        lockMultiplier: Number(event.multiplier),
        rewardDebt: 0n,
        createdAt: timestamp,
        createdAtBlock: BigInt(block.height),
        isWithdrawn: false
      })
      
      stakeLocks.push(lock)
      
      // Update user stake
      let userStake = userStakes.get(userStakeId)
      if (!userStake) {
        userStake = await ctx.store.get(UserStake, userStakeId)
        if (!userStake) {
          userStake = new UserStake({
            id: userStakeId,
            pool: { id: poolId } as StakingPool,
            user: event.user.toLowerCase(),
            flexibleAmount: 0n,
            lockedAmount: 0n,
            weightedAmount: 0n,
            unclaimedRewards: 0n,
            firstStakeAt: timestamp,
            lastStakeAt: timestamp
          })
        }
        userStakes.set(userStakeId, userStake)
      }
      
      userStake.lockedAmount += event.amount
      const weightedAmount = (event.amount * event.multiplier) / 10000n
      userStake.weightedAmount += weightedAmount
      userStake.lastStakeAt = timestamp
      
      // Update pool
      let pool = stakingPools.get(poolId)
      if (!pool) {
        pool = await ctx.store.get(StakingPool, poolId)
        if (!pool) return
        stakingPools.set(poolId, pool)
      }
      
      pool.totalStaked += event.amount
      pool.weightedTotal += weightedAmount
    }
    
    // Handle Withdraw
    else if (log.topics[0] === stakingAbi.events.Withdraw.topic) {
      const event = stakingAbi.events.Withdraw.decode(log)
      const poolId = formatChainEntityId(this.config.id, event.poolId.toString())
      const userStakeId = `${poolId}-${event.user.toLowerCase()}`
      
      let userStake = userStakes.get(userStakeId)
      if (!userStake) {
        userStake = await ctx.store.get(UserStake, userStakeId)
        if (!userStake) return
        userStakes.set(userStakeId, userStake)
      }
      
      userStake.flexibleAmount -= event.amount
      userStake.weightedAmount -= event.amount
      
      // Update pool
      let pool = stakingPools.get(poolId)
      if (!pool) {
        pool = await ctx.store.get(StakingPool, poolId)
        if (!pool) return
        stakingPools.set(poolId, pool)
      }
      
      pool.totalStaked -= event.amount
      pool.weightedTotal -= event.amount
    }
    
    // Handle WithdrawLocked
    else if (log.topics[0] === stakingAbi.events.WithdrawLocked.topic) {
      const event = stakingAbi.events.WithdrawLocked.decode(log)
      const lockId = formatChainEntityId(
        this.config.id,
        `${event.poolId}-${event.user}-${event.lockId}`
      )
      
      const lock = await ctx.store.get(StakeLock, lockId)
      if (lock) {
        lock.isWithdrawn = true
        await ctx.store.save(lock)
        
        // Update user stake
        const userStakeId = lock.userStake.id
        let userStake = userStakes.get(userStakeId)
        if (!userStake) {
          userStake = await ctx.store.get(UserStake, userStakeId)
          if (!userStake) return
          userStakes.set(userStakeId, userStake)
        }
        
        userStake.lockedAmount -= event.amount
        const weightedAmount = (event.amount * BigInt(lock.lockMultiplier)) / 10000n
        userStake.weightedAmount -= weightedAmount
        
        // Update pool
        const poolId = formatChainEntityId(this.config.id, event.poolId.toString())
        let pool = stakingPools.get(poolId)
        if (!pool) {
          pool = await ctx.store.get(StakingPool, poolId)
          if (!pool) return
          stakingPools.set(poolId, pool)
        }
        
        pool.totalStaked -= event.amount
        pool.weightedTotal -= weightedAmount
      }
    }
    
    // Handle RewardsClaimed
    else if (log.topics[0] === stakingAbi.events.RewardsClaimed.topic) {
      const event = stakingAbi.events.RewardsClaimed.decode(log)
      
      const claimId = formatChainEntityId(
        this.config.id,
        `${log.transactionHash}-${log.logIndex}`
      )
      
      // Find which pools the user has stakes in
      const userStakesForUser = await ctx.store.find(UserStake, {
        where: { user: event.user.toLowerCase() }
      })
      
      const pools = userStakesForUser.map(stake => ({ id: stake.pool.id } as StakingPool))
      
      const claim = new StakingRewardClaim({
        id: claimId,
        chain: this.chain!,
        user: event.user.toLowerCase(),
        pools,
        totalAmount: event.amount,
        timestamp,
        block: BigInt(block.height),
        txHash: log.transactionHash
      })
      
      rewardClaims.push(claim)
    }
  }
  
  // Helper methods
  private async getPersonaState(ctx: Context, tokenId: string) {
    const contract = new ethers.Contract(
      this.config.factoryAddress,
      this.FACTORY_INTERFACE,
      null
    )
    
    // Read persona data
    const personaData = await ctx._chain.client.call('eth_call', [
      {
        to: this.config.factoryAddress,
        data: contract.interface.encodeFunctionData('personas', [tokenId])
      },
      'latest'
    ])
    
    const [name, symbol, erc20Token, pairToken, agentToken, pairCreated, createdAt, totalAgentDeposited, minAgentTokens] = 
      contract.interface.decodeFunctionResult('personas', personaData)
    
    // Read purchase data
    const purchaseData = await ctx._chain.client.call('eth_call', [
      {
        to: this.config.factoryAddress,
        data: contract.interface.encodeFunctionData('purchases', [tokenId])
      },
      'latest'
    ])
    
    const [totalDeposited, tokensSold] = 
      contract.interface.decodeFunctionResult('purchases', purchaseData)
    
    // Read pairing config for graduation threshold
    const configData = await ctx._chain.client.call('eth_call', [
      {
        to: this.config.factoryAddress,
        data: contract.interface.encodeFunctionData('pairingConfigs', [pairToken])
      },
      'latest'
    ])
    
    const [, , graduationThreshold] = 
      contract.interface.decodeFunctionResult('pairingConfigs', configData)
    
    return {
      name,
      symbol,
      erc20Token: erc20Token.toLowerCase(),
      pairToken: pairToken.toLowerCase(),
      agentToken: agentToken === ethers.constants.AddressZero ? undefined : agentToken.toLowerCase(),
      pairCreated,
      createdAt: BigInt(createdAt.toString()),
      totalDeposited: BigInt(totalDeposited.toString()),
      tokensSold: BigInt(tokensSold.toString()),
      graduationThreshold: BigInt(graduationThreshold.toString()),
      totalAgentDeposited: BigInt(totalAgentDeposited.toString()),
      minAgentTokens: BigInt(minAgentTokens.toString())
    }
  }
  
  private async getMetadataValue(ctx: Context, tokenId: string, key: string): Promise<string> {
    const contract = new ethers.Contract(
      this.config.factoryAddress,
      this.FACTORY_INTERFACE,
      null
    )
    
    const data = await ctx._chain.client.call('eth_call', [
      {
        to: this.config.factoryAddress,
        data: contract.interface.encodeFunctionData('getMetadata', [tokenId, [key]])
      },
      'latest'
    ])
    
    const [values] = contract.interface.decodeFunctionResult('getMetadata', data)
    return values[0] || ''
  }
  
  private async calculateBaseFeeAmount(ctx: Context, amountIn: bigint): Promise<bigint> {
    const contract = new ethers.Contract(
      this.config.factoryAddress,
      this.FACTORY_INTERFACE,
      null
    )
    
    const data = await ctx._chain.client.call('eth_call', [
      {
        to: this.config.factoryAddress,
        data: contract.interface.encodeFunctionData('tradingFeeConfig', [])
      },
      'latest'
    ])
    
    const [feePercentage] = contract.interface.decodeFunctionResult('tradingFeeConfig', data)
    const fee = BigInt(feePercentage.toString())
    
    return (amountIn * fee) / 10000n
  }
  
  private async calculateEffectiveFee(
    ctx: Context,
    trader: string,
    baseFee: bigint
  ): Promise<bigint> {
    // Try to get effective fee percentage from contract
    const contract = new ethers.Contract(
      this.config.factoryAddress,
      this.FACTORY_INTERFACE,
      null
    )
    
    try {
      const data = await ctx._chain.client.call('eth_call', [
        {
          to: this.config.factoryAddress,
          data: contract.interface.encodeFunctionData('getEffectiveFeePercentage', [trader])
        },
        'latest'
      ])
      
      const [effectiveFeePercentage] = contract.interface.decodeFunctionResult('getEffectiveFeePercentage', data)
      const baseFeePercentage = await this.getBaseFeePercentage(ctx)
      
      // Calculate the effective fee based on the percentage
      return (baseFee * BigInt(effectiveFeePercentage.toString())) / BigInt(baseFeePercentage)
    } catch (error) {
      // Fallback to manual calculation if contract method not available
      return this.calculateEffectiveFeeManually(ctx, trader, baseFee)
    }
  }
  
  private async getBaseFeePercentage(ctx: Context): Promise<number> {
    const contract = new ethers.Contract(
      this.config.factoryAddress,
      this.FACTORY_INTERFACE,
      null
    )
    
    const data = await ctx._chain.client.call('eth_call', [
      {
        to: this.config.factoryAddress,
        data: contract.interface.encodeFunctionData('tradingFeeConfig', [])
      },
      'latest'
    ])
    
    const [feePercentage] = contract.interface.decodeFunctionResult('tradingFeeConfig', data)
    return Number(feePercentage.toString())
  }
  
  private async calculateEffectiveFeeManually(
    ctx: Context,
    trader: string,
    baseFee: bigint
  ): Promise<bigint> {
    // Get fee snapshot
    const snapshotId = formatChainEntityId(this.config.id, trader)
    const snapshot = await ctx.store.get(FeeSnapshot, snapshotId)
    
    if (!snapshot || !snapshot.isActive) return baseFee
    
    // Get fee reduction config
    const feeConfig = await ctx.store.get(FeeReductionConfig, this.config.id.toString())
    if (!feeConfig) return baseFee
    
    const effectiveBalance = snapshot.currentBalance
    
    // Calculate reduction
    if (effectiveBalance >= feeConfig.maxAmicaForReduction) {
      return (baseFee * BigInt(feeConfig.maxReductionMultiplier)) / 10000n
    }
    
    if (effectiveBalance < feeConfig.minAmicaForReduction) {
      return baseFee
    }
    
    // Exponential curve calculation
    const range = feeConfig.maxAmicaForReduction - feeConfig.minAmicaForReduction
    const userPosition = effectiveBalance - feeConfig.minAmicaForReduction
    const progress = (userPosition * 1000000n) / range
    const exponentialProgress = (progress * progress) / 1000000n
    
    const multiplierRange = BigInt(feeConfig.minReductionMultiplier - feeConfig.maxReductionMultiplier)
    const reduction = (multiplierRange * exponentialProgress) / 1000000n
    const effectiveMultiplier = BigInt(feeConfig.minReductionMultiplier) - reduction
    
    return (baseFee * effectiveMultiplier) / 10000n
  }
  
  private async updateDailyVolume(
    ctx: Context,
    persona: Persona,
    timestamp: Date,
    amountIn: bigint,
    trader: string,
    dailyVolumes: Map<string, DailyVolume>
  ) {
    const date = new Date(timestamp)
    date.setUTCHours(0, 0, 0, 0)
    
    const id = `${persona.id}-${date.toISOString().split('T')[0]}`
    let dailyVolume = dailyVolumes.get(id)
    
    if (!dailyVolume) {
      dailyVolume = await ctx.store.get(DailyVolume, id)
      if (!dailyVolume) {
        dailyVolume = new DailyVolume({
          id,
          persona,
          date,
          volume: 0n,
          trades: 0,
          uniqueTraders: 0
        })
      }
      dailyVolumes.set(id, dailyVolume)
    }
    
    dailyVolume.volume += amountIn
    dailyVolume.trades += 1
    
    // Track unique traders (simplified - in production, track properly)
    // This is a placeholder - you'd want to track unique traders properly
    dailyVolume.uniqueTraders += 1
  }
  
  private async update24hStats(ctx: Context, persona: Persona, timestamp: Date) {
    const twentyFourHoursAgo = new Date(timestamp.getTime() - 24 * 60 * 60 * 1000)
    
    // Get trades from last 24h
    const recentTrades = await ctx.store.find(Trade, {
      where: {
        persona: { id: persona.id },
        timestamp: MoreThanOrEqual(twentyFourHoursAgo)
      }
    })
    
    // Calculate 24h stats
    persona.totalVolume24h = recentTrades.reduce((sum, trade) => sum + trade.amountIn, 0n)
    persona.totalTrades24h = recentTrades.length
    
    // Count unique traders
    const uniqueTraders = new Set(recentTrades.map(t => t.trader))
    persona.uniqueTraders24h = uniqueTraders.size
  }
  
  private async handleAmicaTokenEvent(
    ctx: Context,
    log: Log,
    block: BlockHeader<Fields>,
    timestamp: Date,
    amicaDeposits: AmicaTokenDeposit[]
  ) {
    // Handle TokensDeposited
    if (log.topics[0] === amicaAbi.events.TokensDeposited.topic) {
      const event = amicaAbi.events.TokensDeposited.decode(log)
      
      const depositId = formatChainEntityId(
        this.config.id,
        `${log.transactionHash}-${log.logIndex}`
      )
      
      const deposit = new AmicaTokenDeposit({
        id: depositId,
        chain: this.chain!,
        depositor: event.depositor.toLowerCase(),
        token: event.token.toLowerCase(),
        amount: event.amount,
        timestamp,
        block: BigInt(block.height),
        txHash: log.transactionHash
      })
      
      amicaDeposits.push(deposit)
      
      ctx.log.info(`AMICA deposit on ${this.config.name}: ${event.amount} of ${event.token}`)
    }
  }
  
  private async handleBridgeWrapperEvent(
    ctx: Context,
    log: Log,
    block: BlockHeader<Fields>,
    timestamp: Date,
    bridgeActivities: BridgeActivity[]
  ) {
    const activityId = formatChainEntityId(
      this.config.id,
      `${log.transactionHash}-${log.logIndex}`
    )
    
    // Handle TokensWrapped
    if (log.topics[0] === wrapperAbi.events.TokensWrapped.topic) {
      const event = wrapperAbi.events.TokensWrapped.decode(log)
      
      const activity = new BridgeActivity({
        id: activityId,
        chain: this.chain!,
        user: event.user.toLowerCase(),
        action: BridgeAction.WRAP,
        amount: event.amount,
        timestamp,
        block: BigInt(block.height),
        txHash: log.transactionHash
      })
      
      bridgeActivities.push(activity)
      
      ctx.log.info(`Bridge wrap on ${this.config.name}: ${event.amount} by ${event.user}`)
    }
    
    // Handle TokensUnwrapped
    else if (log.topics[0] === wrapperAbi.events.TokensUnwrapped.topic) {
      const event = wrapperAbi.events.TokensUnwrapped.decode(log)
      
      const activity = new BridgeActivity({
        id: activityId,
        chain: this.chain!,
        user: event.user.toLowerCase(),
        action: BridgeAction.UNWRAP,
        amount: event.amount,
        timestamp,
        block: BigInt(block.height),
        txHash: log.transactionHash
      })
      
      bridgeActivities.push(activity)
      
      ctx.log.info(`Bridge unwrap on ${this.config.name}: ${event.amount} by ${event.user}`)
    }
  }
  
  private async saveEntities(
    ctx: Context,
    personas: Map<string, Persona>,
    metadata: Map<string, Metadata>,
    trades: Trade[],
    dailyVolumes: Map<string, DailyVolume>,
    bridgeActivities: BridgeActivity[],
    amicaDeposits: AmicaTokenDeposit[],
    agentDeposits: AgentDeposit[],
    agentRewards: AgentReward[],
    feeSnapshots: Map<string, FeeSnapshot>,
    stakingPools: Map<string, StakingPool>,
    userStakes: Map<string, UserStake>,
    stakeLocks: StakeLock[],
    rewardClaims: StakingRewardClaim[]
  ) {
    // Update chain entity
    if (this.chain) {
      await ctx.store.upsert(this.chain)
    }
    
    // Update fee snapshots to mark active ones
    for (const snapshot of feeSnapshots.values()) {
      const currentBlock = BigInt(ctx.blocks[ctx.blocks.length - 1].header.height)
      if (snapshot.currentBlock && currentBlock >= snapshot.currentBlock + 100n) {
        snapshot.isActive = true
      }
    }
    
    // Save all entities
    if (personas.size > 0) {
      await ctx.store.upsert([...personas.values()])
    }
    if (metadata.size > 0) {
      await ctx.store.upsert([...metadata.values()])
    }
    if (trades.length > 0) {
      await ctx.store.insert(trades)
    }
    if (dailyVolumes.size > 0) {
      await ctx.store.upsert([...dailyVolumes.values()])
    }
    if (bridgeActivities.length > 0) {
      await ctx.store.insert(bridgeActivities)
    }
    if (amicaDeposits.length > 0) {
      await ctx.store.insert(amicaDeposits)
    }
    if (agentDeposits.length > 0) {
      await ctx.store.insert(agentDeposits)
    }
    if (agentRewards.length > 0) {
      await ctx.store.insert(agentRewards)
    }
    if (feeSnapshots.size > 0) {
      await ctx.store.upsert([...feeSnapshots.values()])
    }
    if (stakingPools.size > 0) {
      await ctx.store.upsert([...stakingPools.values()])
    }
    if (userStakes.size > 0) {
      await ctx.store.upsert([...userStakes.values()])
    }
    if (stakeLocks.length > 0) {
      await ctx.store.insert(stakeLocks)
    }
    if (rewardClaims.length > 0) {
      await ctx.store.insert(rewardClaims)
    }
    
    ctx.log.info(`Processed block ${ctx.blocks[ctx.blocks.length - 1].header.height} on ${this.config.name}`)
  }
}
