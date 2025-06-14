import { TypeormDatabase } from '@subsquid/typeorm-store'
import { processor, FACTORY_ADDRESS } from './processor'
import { Persona, Metadata, Trade, DailyVolume } from './model'
import * as factoryAbi from './abi/PersonaTokenFactory'
import { Store } from './types'

// Helper to get or create daily volume
async function getOrCreateDailyVolume(
  store: Store,
  personaId: string,
  timestamp: Date
): Promise<DailyVolume> {
  const date = new Date(timestamp)
  date.setUTCHours(0, 0, 0, 0)
  
  const id = `${personaId}-${date.toISOString().split('T')[0]}`
  let dailyVolume = await store.get(DailyVolume, id)
  
  if (!dailyVolume) {
    dailyVolume = new DailyVolume({
      id,
      persona: { id: personaId } as Persona,
      date,
      volume: 0n,
      trades: 0,
      uniqueTraders: 0
    })
  }
  
  return dailyVolume
}

// Helper to update 24h stats
async function update24hStats(
  store: Store,
  persona: Persona,
  timestamp: Date
): Promise<void> {
  const twentyFourHoursAgo = new Date(timestamp.getTime() - 24 * 60 * 60 * 1000)
  
  // Use MoreThanOrEqual instead of gte
  const recentTrades = await store.find(Trade, {
    where: {
      persona: { id: persona.id },
      timestamp: {
        $gte: twentyFourHoursAgo
      } as any
    }
  })
  
  // Calculate 24h stats
  persona.totalVolume24h = recentTrades.reduce((sum: bigint, trade: any) => sum + trade.amountIn, 0n)
  persona.totalTrades24h = recentTrades.length
  
  // Count unique traders
  const uniqueTraders = new Set(recentTrades.map((t: any) => t.trader))
  persona.uniqueTraders24h = uniqueTraders.size
}

processor.run(new TypeormDatabase({ supportHotBlocks: true }), async (ctx) => {
  const personas: Map<string, Persona> = new Map()
  const metadata: Map<string, Metadata> = new Map()
  const trades: Trade[] = []
  const dailyVolumes: Map<string, DailyVolume> = new Map()
  
  for (const block of ctx.blocks) {
    for (const log of block.logs) {
      if (log.address !== FACTORY_ADDRESS) continue
      
      const timestamp = new Date(block.header.timestamp)
      
      // Handle PersonaCreated event
      if (log.topics[0] === factoryAbi.events.PersonaCreated.topic) {
        const event = factoryAbi.events.PersonaCreated.decode(log)
        
        const persona = new Persona({
          id: event.tokenId.toString(),
          tokenId: event.tokenId,
          creator: event.creator.toLowerCase(),
          name: event.name,
          symbol: event.symbol,
          erc20Token: event.erc20Token.toLowerCase(),
          pairToken: '0x...', // You'll need to fetch this from contract
          pairCreated: false,
          createdAt: timestamp,
          createdAtBlock: BigInt(block.header.height),
          totalVolume24h: 0n,
          totalVolumeAllTime: 0n,
          totalTrades24h: 0,
          totalTradesAllTime: 0,
          uniqueTraders24h: 0,
          uniqueTradersAllTime: 0,
          totalDeposited: 0n,
          tokensSold: 0n,
          graduationThreshold: 0n, // Fetch from contract
          isGraduated: false,
          chain: { id: '1' } as any // Add chain reference
        })
        
        personas.set(persona.id, persona)
      }
      
      // Handle TokensPurchased event
      else if (log.topics[0] === factoryAbi.events.TokensPurchased.topic) {
        const event = factoryAbi.events.TokensPurchased.decode(log)
        const personaId = event.tokenId.toString()
        
        // Get or load persona
        let persona = personas.get(personaId)
        if (!persona) {
          persona = await ctx.store.get(Persona, personaId)
          if (!persona) continue
          personas.set(personaId, persona)
        }
        
        // Create trade record
        const trade = new Trade({
          id: `${log.transactionHash}-${log.logIndex}`,
          persona,
          trader: event.buyer.toLowerCase(),
          amountIn: event.amountSpent,
          amountOut: event.tokensReceived,
          feeAmount: 0n, // Calculate from amountIn if needed
          timestamp,
          block: BigInt(block.header.height),
          txHash: log.transactionHash,
          chain: { id: '1' } as any // Add chain reference
        })
        trades.push(trade)
        
        // Update persona stats
        persona.totalVolumeAllTime += trade.amountIn
        persona.totalTradesAllTime += 1
        persona.totalDeposited += trade.amountIn
        persona.tokensSold += trade.amountOut
        
        // Update daily volume
        const dailyVolume = await getOrCreateDailyVolume(ctx.store, personaId, timestamp)
        dailyVolume.volume += trade.amountIn
        dailyVolume.trades += 1
        dailyVolumes.set(dailyVolume.id, dailyVolume)
        
        // Update 24h stats
        await update24hStats(ctx.store, persona, timestamp)
      }
      
      // Handle MetadataUpdated event
      else if (log.topics[0] === factoryAbi.events.MetadataUpdated.topic) {
        const event = factoryAbi.events.MetadataUpdated.decode(log)
        const personaId = event.tokenId.toString()
        const key = event.key
        
        const metadataId = `${personaId}-${key}`
        const metadataItem = new Metadata({
          id: metadataId,
          persona: { id: personaId } as Persona,
          key,
          value: '', // You'll need to fetch this from contract
          updatedAt: timestamp,
          updatedAtBlock: BigInt(block.header.height)
        })
        
        metadata.set(metadataId, metadataItem)
      }
      
      // Handle LiquidityPairCreated event
      else if (log.topics[0] === factoryAbi.events.LiquidityPairCreated.topic) {
        const event = factoryAbi.events.LiquidityPairCreated.decode(log)
        const personaId = event.tokenId.toString()
        
        let persona = personas.get(personaId)
        if (!persona) {
          persona = await ctx.store.get(Persona, personaId)
          if (!persona) continue
          personas.set(personaId, persona)
        }
        
        persona.pairCreated = true
        persona.pairAddress = event.pair.toLowerCase()
        persona.isGraduated = true
      }
    }
  }
  
  // Save all entities
  await ctx.store.upsert([...personas.values()])
  await ctx.store.upsert([...metadata.values()])
  await ctx.store.insert(trades)
  await ctx.store.upsert([...dailyVolumes.values()])
})
