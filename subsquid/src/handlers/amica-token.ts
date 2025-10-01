import { Context, Log } from '../processor'
import * as amicaAbi from '../abi/AmicaToken'
import { AmicaTransfer, AmicaClaim } from '../model'
import { DEPLOYMENT } from '../processor'

export async function handleAmicaTransfer(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
): Promise<void> {
  const event = amicaAbi.events.Transfer.decode(log)

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
    isToStaking: event.to.toLowerCase() === DEPLOYMENT.addresses.stakingRewards,
    isFromStaking: event.from.toLowerCase() === DEPLOYMENT.addresses.stakingRewards,
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
  const event = amicaAbi.events.TokenClaimed.decode(log)

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
