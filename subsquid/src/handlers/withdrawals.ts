import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona, TokenWithdrawal } from '../model'
import { DEPLOYMENT } from '../processor'

// Note: TokensWithdrawn event no longer exists in the new contract
// Only TokensClaimed is used now for post-graduation token claims

export async function handleTokensClaimed(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  // Event: TokensClaimed(uint256 tokenId, address user, uint256 purchasedAmount, uint256 bonusAmount, uint256 totalAmount)
  const event = factoryAbi.events.TokensClaimed.decode(log)

  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)

  if (!persona) {
    ctx.log.error(`Persona not found for token claim: ${personaId}`)
    return
  }

  // Create a withdrawal record for the claim
  const claimId = `${log.transactionHash}-${log.logIndex}`
  const claim = new TokenWithdrawal({
    id: claimId,
    persona,
    user: event.user.toLowerCase(),
    amount: event.totalAmount,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })

  await ctx.store.insert(claim)

  ctx.log.info(`Tokens claimed for persona ${personaId} by ${event.user}:`)
  ctx.log.info(`  - Purchased Amount: ${event.purchasedAmount}`)
  ctx.log.info(`  - Bonus Amount: ${event.bonusAmount}`)
  ctx.log.info(`  - Total Amount: ${event.totalAmount}`)
}
