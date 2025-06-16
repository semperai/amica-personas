import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from '@subsquid/evm-processor'
import { Store } from '@subsquid/typeorm-store'
import * as factoryAbi from './abi/PersonaTokenFactory'
import * as stakingAbi from './abi/PersonaStakingRewards'
import * as bridgeAbi from './abi/AmicaBridgeWrapper'
import * as amicaAbi from './abi/AmicaToken'

// Base deployment data
export const DEPLOYMENT = {
  chainId: 8453,
  chainName: 'base',
  addresses: {
    amicaToken: '0xC0ba25570F4cB592e83FF5f052cC9DD69D5b3caE'.toLowerCase(),
    personaFactory: '0x62966fd253C2c3507A305f296E54cabD74AEA083'.toLowerCase(),
    bridgeWrapper: '0xe17B125b85AbCC0Ff212cf33d06d928d4736aA04'.toLowerCase(),
    stakingRewards: '0xEfc05BA7cca5653a71dA0569D589848dfAb60CdA'.toLowerCase(),
    erc20Implementation: '0x4b140c2d84c75D50E28b46f4126fF9C1c5e4C3DD'.toLowerCase(),
  },
  startBlock: 31632254,
}

export const processor = new EvmBatchProcessor()
  .setGateway('https://v2.archive.subsquid.io/network/base-mainnet')
  .setRpcEndpoint({
    url: process.env.RPC_BASE_HTTP || 'https://mainnet.base.org',
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
      factoryAbi.events.TokensPurchased.topic,
      factoryAbi.events.MetadataUpdated.topic,
      factoryAbi.events.LiquidityPairCreated.topic,
      factoryAbi.events.TradingFeesCollected.topic,
      factoryAbi.events.FeeReductionConfigUpdated.topic,
      factoryAbi.events.SnapshotUpdated.topic,
      factoryAbi.events.AgentTokenAssociated.topic,
      factoryAbi.events.AgentTokensDeposited.topic,
      factoryAbi.events.AgentTokensWithdrawn.topic,
      factoryAbi.events.AgentRewardsDistributed.topic,
      factoryAbi.events.TradingFeeConfigUpdated.topic,
    ]
  })
  // StakingRewards events
  .addLog({
    address: [DEPLOYMENT.addresses.stakingRewards],
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
  // BridgeWrapper events
  .addLog({
    address: [DEPLOYMENT.addresses.bridgeWrapper],
    topic0: [
      bridgeAbi.events.TokensWrapped.topic,
      bridgeAbi.events.TokensUnwrapped.topic,
    ]
  })
  // AmicaToken events (for deposits)
  .addLog({
    address: [DEPLOYMENT.addresses.amicaToken],
    topic0: [
      amicaAbi.events.TokensDeposited.topic,
    ]
  })

export type Fields = EvmBatchProcessorFields<typeof processor>
export type Context = DataHandlerContext<Store, Fields>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
