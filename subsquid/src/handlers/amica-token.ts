import { Context, Log } from '../processor'
import * as amicaMainnetAbi from '../abi/AmicaTokenMainnet'
import * as amicaBridgedAbi from '../abi/AmicaTokenBridged'
import { AmicaTransfer, AmicaClaim, AmicaDeposit, AmicaTokenConfig, AmicaWithdrawal } from '../model'
import { DEPLOYMENT } from '../processor'

export async function handleAmicaTransfer(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  const event = amicaMainnetAbi.events.Transfer.decode(log)

  // Skip mint/burn events (from/to zero address)
  if (event.from === '0x0000000000000000000000000000000000000000' ||
      event.to === '0x0000000000000000000000000000000000000000') {
    ctx.log.debug(`Skipping mint/burn transfer: from=${event.from}, to=${event.to}`)
    return
  }

  const transfer = new AmicaTransfer({
    id: `${log.transactionHash}-${log.logIndex}`,
    from: event.from.toLowerCase(),
    to: event.to.toLowerCase(),
    value: event.value,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
    // Context flags
    isToFactory: event.to.toLowerCase() === DEPLOYMENT.addresses.personaFactory,
    isFromFactory: event.from.toLowerCase() === DEPLOYMENT.addresses.personaFactory,
    isToBridge: event.to.toLowerCase() === DEPLOYMENT.addresses.bridgeWrapper,
    isFromBridge: event.from.toLowerCase() === DEPLOYMENT.addresses.bridgeWrapper,
  })

  await ctx.store.insert(transfer)

  ctx.log.info(`AMICA Transfer: ${event.value} from ${event.from} to ${event.to}`)
}

export async function handleAmicaTokenClaimed(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  const event = amicaMainnetAbi.events.TokenClaimed.decode(log)

  const claim = new AmicaClaim({
    id: `${log.transactionHash}-${log.logIndex}`,
    user: event.user.toLowerCase(),
    claimedToken: event.claimedToken.toLowerCase(),
    amountBurned: event.amountBurned,
    amountClaimed: event.amountClaimed,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })

  await ctx.store.insert(claim)

  ctx.log.info(`AMICA TokenClaimed: ${event.user} burned ${event.amountBurned} to claim ${event.amountClaimed} of ${event.claimedToken}`)
}

export async function handleAmicaTokenDeposited(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  const event = amicaMainnetAbi.events.TokenDeposited.decode(log)

  const deposit = new AmicaDeposit({
    id: `${log.transactionHash}-${log.logIndex}`,
    user: event.user.toLowerCase(),
    token: event.token.toLowerCase(),
    amountDeposited: event.amountDeposited,
    amountMinted: event.amountMinted,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })

  await ctx.store.insert(deposit)

  ctx.log.info(`AMICA TokenDeposited: ${event.user} deposited ${event.amountDeposited} of ${event.token} and minted ${event.amountMinted} AMICA`)
}

export async function handleAmicaTokenConfigured(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  const event = amicaMainnetAbi.events.TokenConfigured.decode(log)

  const configId = event.token.toLowerCase()
  let config = await ctx.store.get(AmicaTokenConfig, configId)

  if (!config) {
    config = new AmicaTokenConfig({
      id: configId,
      token: event.token.toLowerCase(),
      enabled: event.enabled,
      exchangeRate: event.exchangeRate,
      decimals: event.decimals,
      lastUpdated: timestamp,
      lastUpdatedBlock: blockNumber,
      txHash: log.transactionHash,
    })
  } else {
    config.enabled = event.enabled
    config.exchangeRate = event.exchangeRate
    config.decimals = event.decimals
    config.lastUpdated = timestamp
    config.lastUpdatedBlock = blockNumber
    config.txHash = log.transactionHash
  }

  await ctx.store.save(config)

  ctx.log.info(`AMICA TokenConfigured: ${event.token} enabled=${event.enabled} rate=${event.exchangeRate} decimals=${event.decimals}`)
}

export async function handleAmicaTokenWithdrawn(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  const event = amicaMainnetAbi.events.TokenWithdrawn.decode(log)

  const withdrawal = new AmicaWithdrawal({
    id: `${log.transactionHash}-${log.logIndex}`,
    token: event.token.toLowerCase(),
    to: event.to.toLowerCase(),
    amount: event.amount,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })

  await ctx.store.insert(withdrawal)

  ctx.log.info(`AMICA TokenWithdrawn: ${event.amount} of ${event.token} withdrawn to ${event.to}`)
}
