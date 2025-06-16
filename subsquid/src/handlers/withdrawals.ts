import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona, TokenWithdrawal } from '../model'
import { DEPLOYMENT } from '../processor'

export async function handleTokensWithdrawn(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = factoryAbi.events.TokensWithdrawn.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found for withdrawal: ${personaId}`)
    return
  }
  
  // Create withdrawal record
  const withdrawalId = `${log.transactionHash}-${log.logIndex}`
  const withdrawal = new TokenWithdrawal({
    id: withdrawalId,
    persona,
    user: event.user.toLowerCase(),
    amount: event.amount,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
    chainId: DEPLOYMENT.chainId,
  })
  
  await ctx.store.insert(withdrawal)
  
  ctx.log.info(`${event.amount} tokens withdrawn from persona ${personaId} by ${event.user}`)
}
