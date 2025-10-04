import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor'
import { assertNotNull } from '@subsquid/util-internal'
import { Store } from '@subsquid/typeorm-store'
import * as factoryAbi from './abi/PersonaTokenFactory'
import * as bridgeAbi from './abi/AmicaBridgeWrapper'
import * as amicaAbi from './abi/AmicaTokenMainnet'

// Base deployment data
export const DEPLOYMENT = {
  chainId: 8453,
  chainName: 'base',
  addresses: {
    amicaToken: '0xC0ba25570F4cB592e83FF5f052cC9DD69D5b3caE'.toLowerCase(),
    personaFactory: '0x62966fd253C2c3507A305f296E54cabD74AEA083'.toLowerCase(),
    bridgeWrapper: '0xe17B125b85AbCC0Ff212cf33d06d928d4736aA04'.toLowerCase(),
    erc20Implementation: '0x4b140c2d84c75D50E28b46f4126fF9C1c5e4C3DD'.toLowerCase(),
  },
  startBlock: 31632211,
}

// Log RPC configuration
const rpcUrl = process.env.RPC_BASE_HTTP || 'https://mainnet.base.org'
console.log('=== PROCESSOR CONFIGURATION ===')
console.log(`RPC URL: ${rpcUrl}`)
console.log(`Archive Gateway: https://v2.archive.subsquid.io/network/base-mainnet`)
console.log(`Start Block: ${DEPLOYMENT.startBlock}`)
console.log(`Finality Confirmation: 75 blocks`)
console.log('==============================')

export const processor = new EvmBatchProcessor()
  .setGateway('https://v2.archive.subsquid.io/network/base-mainnet')
  .setRpcEndpoint({
    url: rpcUrl,
    rateLimit: 10
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
    from: DEPLOYMENT.startBlock,
  })
  // PersonaTokenFactory events
  .addLog({
    address: [DEPLOYMENT.addresses.personaFactory],
    topic0: [
      factoryAbi.events.PersonaCreated.topic,
      factoryAbi.events.Transfer.topic,
      factoryAbi.events.TokensPurchased.topic,
      factoryAbi.events.TokensSold.topic,
      factoryAbi.events.MetadataUpdated.topic,
      factoryAbi.events.V4PoolCreated.topic,
      factoryAbi.events.FeesCollected.topic,
      factoryAbi.events.Graduated.topic,
      factoryAbi.events.TokensClaimed.topic,
      factoryAbi.events.TokensDistributed.topic,
      factoryAbi.events.AgentTokenAssociated.topic,
      factoryAbi.events.AgentTokensDeposited.topic,
      factoryAbi.events.AgentTokensWithdrawn.topic,
      factoryAbi.events.AgentRewardsDistributed.topic,
      factoryAbi.events.PairingConfigUpdated.topic,
    ]
  })
  // BridgeWrapper events
  .addLog({
    address: [DEPLOYMENT.addresses.bridgeWrapper],
    topic0: [
      bridgeAbi.events.TokensWrapped.topic,
      bridgeAbi.events.TokensUnwrapped.topic,
      bridgeAbi.events.EmergencyWithdraw.topic,
      bridgeAbi.events.BridgeMetricsUpdated.topic,
      bridgeAbi.events.BridgeTokensUpdated.topic,
    ]
  })
  // AmicaToken events (track all AMICA transfers and claims)
  .addLog({
    address: [DEPLOYMENT.addresses.amicaToken],
    topic0: [
      amicaAbi.events.Transfer.topic,
      amicaAbi.events.TokenClaimed.topic,
      amicaAbi.events.TokenDeposited.topic,
      amicaAbi.events.TokenConfigured.topic,
      amicaAbi.events.TokenWithdrawn.topic,
    ]
  })

// Log event topic registration
console.log('Registered event topics:')
console.log('- PersonaFactory:', Object.keys(factoryAbi.events).length, 'events')
console.log('- BridgeWrapper:', Object.keys(bridgeAbi.events).length, 'events')
console.log('- AmicaToken:', Object.keys(amicaAbi.events).length, 'events')

export type Fields = EvmBatchProcessorFields<typeof processor>
export type Context = DataHandlerContext<Store, Fields>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
