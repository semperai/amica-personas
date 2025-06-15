// src/main.ts
import { TypeormDatabase } from '@subsquid/typeorm-store'
import { EthereumProcessor } from './processors/ethereum.processor'
import { BaseProcessor } from './processors/base.processor'
import { GlobalStats } from './model'

// Main entry point - runs both chain processors
async function main() {
  console.log('Starting Amica multichain indexer...')
  
  // Initialize database
  const db = new TypeormDatabase({ supportHotBlocks: true })
  
  // Initialize global stats if not exists
  await db.connect()
  let globalStats = await db.store.get(GlobalStats, 'global')
  if (!globalStats) {
    globalStats = new GlobalStats({
      id: 'global',
      totalPersonas: 0,
      totalVolume24h: 0n,
      totalVolumeAllTime: 0n,
      totalBridgedVolume: 0n,
      totalChains: 2, // Ethereum and Base
      totalStakingPools: 0,
      totalStakedValue: 0n,
      totalAgentTokensDeposited: 0n,
      lastUpdated: new Date()
    })
    await db.store.insert(globalStats)
  }
  await db.close()
  
  // Create processors
  const ethereumProcessor = new EthereumProcessor()
  const baseProcessor = new BaseProcessor()
  
  // Run processors in parallel
  console.log('Starting Ethereum processor...')
  console.log('Starting Base processor...')
  
  await Promise.all([
    ethereumProcessor.process(new TypeormDatabase({ supportHotBlocks: true })),
    baseProcessor.process(new TypeormDatabase({ supportHotBlocks: true }))
  ])
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

// Run the main function
main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
