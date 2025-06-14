import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor'
import { lookupArchive } from '@subsquid/archive-registry'
import * as factoryAbi from './abi/PersonaTokenFactory'
import { Store } from '@subsquid/typeorm-store'

// Update with your contract address and deployment block
export const FACTORY_ADDRESS = '0x...' // Your PersonaTokenFactory address
export const DEPLOYMENT_BLOCK = 0 // Your deployment block

export const processor = new EvmBatchProcessor()
  .setDataSource({
    archive: lookupArchive('base-mainnet'), // or your network
    chain: {
      url: process.env.RPC_ENDPOINT || 'https://mainnet.base.org',
      rateLimit: 10
    }
  })
  .setFinalityConfirmation(75)
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
  .setBlockRange({
    from: DEPLOYMENT_BLOCK,
  })
  .addLog({
    address: [FACTORY_ADDRESS],
    topic0: [
      factoryAbi.events.PersonaCreated.topic,
      factoryAbi.events.TokensPurchased.topic,
      factoryAbi.events.MetadataUpdated.topic,
      factoryAbi.events.LiquidityPairCreated.topic,
    ]
  })

export type Fields = EvmBatchProcessorFields<typeof processor>
export type Context = DataHandlerContext<Store, Fields>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
