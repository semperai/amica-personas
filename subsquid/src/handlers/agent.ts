import { Context, Log } from '../processor'
import * as factoryAbi from '../abi/PersonaTokenFactory'
import { Persona, AgentDeposit, AgentReward } from '../model'

export async function handleAgentTokenAssociated(
  ctx: Context,
  log: Log
) {
  const event = factoryAbi.events.AgentTokenAssociated.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }
  
  persona.agentToken = event.agentToken.toLowerCase()
  await ctx.store.save(persona)
  
  ctx.log.info(`Agent token associated with persona ${personaId}: ${event.agentToken}`)
}

export async function handleAgentTokensDeposited(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = factoryAbi.events.AgentTokensDeposited.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }
  
  // Find existing deposit or create new one
  const depositId = `${personaId}-${event.depositor.toLowerCase()}-${log.logIndex}`
  
  const deposit = new AgentDeposit({
    id: depositId,
    persona,
    user: event.depositor.toLowerCase(),
    amount: event.amount,
    timestamp,
    withdrawn: false,
    rewardsClaimed: false,
    block: blockNumber,
    txHash: log.transactionHash,
  })
  
  await ctx.store.insert(deposit)
  
  // Update persona total
  persona.totalAgentDeposited = persona.totalAgentDeposited + event.amount
  await ctx.store.save(persona)
  
  ctx.log.info(`Agent tokens deposited: ${event.amount} for persona ${personaId}`)
}

export async function handleAgentTokensWithdrawn(
  ctx: Context,
  log: Log
) {
  const event = factoryAbi.events.AgentTokensWithdrawn.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }
  
  // Find deposits to mark as withdrawn
  const deposits = await ctx.store.find(AgentDeposit, {
    where: {
      persona: { id: personaId },
      user: event.depositor.toLowerCase(),
      withdrawn: false
    }
  })
  
  // Mark deposits as withdrawn up to the amount
  let remainingToWithdraw = event.amount
  for (const deposit of deposits) {
    if (remainingToWithdraw <= 0n) break
    
    if (deposit.amount <= remainingToWithdraw) {
      deposit.withdrawn = true
      remainingToWithdraw = remainingToWithdraw - deposit.amount
    }
    await ctx.store.save(deposit)
  }
  
  // Update persona total
  persona.totalAgentDeposited = persona.totalAgentDeposited - event.amount
  await ctx.store.save(persona)
  
  ctx.log.info(`Agent tokens withdrawn: ${event.amount} from persona ${personaId}`)
}

export async function handleAgentRewardsDistributed(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = factoryAbi.events.AgentRewardsDistributed.decode(log)
  
  const personaId = event.tokenId.toString()
  const persona = await ctx.store.get(Persona, personaId)
  
  if (!persona) {
    ctx.log.error(`Persona not found: ${personaId}`)
    return
  }
  
  const rewardId = `${log.transactionHash}-${log.logIndex}`
  
  const reward = new AgentReward({
    id: rewardId,
    persona,
    user: event.recipient.toLowerCase(),
    personaTokensReceived: event.personaTokens,
    agentTokenAmount: event.agentShare,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
  })
  
  await ctx.store.insert(reward)
  
  // Mark deposits as claimed
  const deposits = await ctx.store.find(AgentDeposit, {
    where: {
      persona: { id: personaId },
      user: event.recipient.toLowerCase(),
      rewardsClaimed: false
    }
  })
  
  for (const deposit of deposits) {
    deposit.rewardsClaimed = true
    await ctx.store.save(deposit)
  }
  
  ctx.log.info(`Agent rewards distributed: ${event.personaTokens} tokens to ${event.recipient}`)
}
