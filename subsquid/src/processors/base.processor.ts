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
import { 
  Chain, 
  Persona, 
  Metadata, 
  Trade, 
  DailyVolume,
  BridgeActivity,
  BridgeAction,
  AmicaTokenDeposit
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
    'function personas(uint256) view returns (string name, string symbol, address erc20Token, address pairToken, bool pairCreated, uint256 createdAt)',
    'function purchases(uint256) view returns (uint256 totalDeposited, uint256 tokensSold)',
    'function pairingConfigs(address) view returns (bool enabled, uint256 mintCost, uint256 graduationThreshold)',
    'function getMetadata(uint256 tokenId, string[] keys) view returns (string[])',
    'function tradingFeeConfig() view returns (uint256 feePercentage, uint256 creatorShare)'
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
    
    for (const block of ctx.blocks) {
      for (const log of block.logs) {
        // Access timestamp from block.header
        const timestamp = new Date(block.header.timestamp)
        
        // Handle PersonaTokenFactory events
        if (log.address.toLowerCase() === this.config.factoryAddress.toLowerCase()) {
          await this.handleFactoryEvent(
            ctx, log, block.header, timestamp,
            personas, metadata, trades, dailyVolumes
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
      amicaDeposits
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
    dailyVolumes: Map<string, DailyVolume>
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
        pairCreated: state.pairCreated,
        createdAt: timestamp,
        createdAtBlock: BigInt(block.height),
        totalVolume24h: 0n,
        totalVolumeAllTime: 0n,
        totalTrades24h: 0,
        totalTradesAllTime: 0,
        uniqueTraders24h: 0,
        uniqueTradersAllTime: 0,
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
      
      // Calculate fee amount
      const amountIn = event.amountSpent;
      const feeAmount = await this.calculateFeeAmount(ctx, amountIn)
      
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
        amountIn,
        amountOut: event.tokensReceived,
        feeAmount,
        timestamp,
        block: BigInt(block.height),
        txHash: log.transactionHash
      })
      trades.push(trade)
      
      // Update persona stats
      persona.totalVolumeAllTime += amountIn
      persona.totalTradesAllTime += 1
      
      // Update chain volume
      this.chain!.totalVolume += amountIn
      
      // Update daily volume
      await this.updateDailyVolume(
        ctx, persona, timestamp, amountIn, trader, dailyVolumes
      )
      
      // Update 24h stats
      await this.update24hStats(ctx, persona, timestamp)
      
      ctx.log.info(`Trade on ${this.config.name}: ${trader} bought persona ${tokenId}`)
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
    
    const [name, symbol, erc20Token, pairToken, pairCreated, createdAt] = 
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
      pairCreated,
      createdAt: BigInt(createdAt.toString()),
      totalDeposited: BigInt(totalDeposited.toString()),
      tokensSold: BigInt(tokensSold.toString()),
      graduationThreshold: BigInt(graduationThreshold.toString())
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
  
  private async calculateFeeAmount(ctx: Context, amountIn: bigint): Promise<bigint> {
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
  
  private async saveEntities(
    ctx: Context,
    personas: Map<string, Persona>,
    metadata: Map<string, Metadata>,
    trades: Trade[],
    dailyVolumes: Map<string, DailyVolume>,
    bridgeActivities: BridgeActivity[],
    amicaDeposits: AmicaTokenDeposit[]
  ) {
    // Update chain entity
    if (this.chain) {
      await ctx.store.upsert(this.chain)
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
    
    ctx.log.info(`Processed block ${ctx.blocks[ctx.blocks.length - 1].header.height} on ${this.config.name}`)
  }
}
