// src/processors/ethereum.processor.ts
import { TypeormDatabase } from '@subsquid/typeorm-store'
import { BaseChainProcessor } from './base'
import { CHAIN_CONFIGS } from '../config/chains'

export class EthereumProcessor extends BaseChainProcessor {
  constructor() {
    super(CHAIN_CONFIGS.ethereum)
  }
}

// Run the processor if this file is executed directly
async function main() {
  const processor = new EthereumProcessor()
  await processor.process(new TypeormDatabase({ supportHotBlocks: true }))
}

if (require.main === module) {
  main().catch(err => {
    console.error('Ethereum processor error:', err)
    process.exit(1)
  })
}
