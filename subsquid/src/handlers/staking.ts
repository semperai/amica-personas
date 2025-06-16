import { Context, Log } from '../processor'
import * as stakingAbi from '../abi/PersonaStakingRewards'
import { StakingPool, UserStake, StakeLock, StakingRewardClaim } from '../model'

export async function handlePoolAdded(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = stakingAbi.events.PoolAdded.decode(log)
  
  const poolId = event.poolId.toString()
  
  // Check if pool already exists
  let pool = await ctx.store.get(StakingPool, poolId)
  if (pool) {
    ctx.log.warn(`Pool ${poolId} already exists`)
    return
  }
  
  pool = new StakingPool({
    id: poolId,
    poolId: Number(event.poolId),
    lpToken: event.lpToken.toLowerCase(),
    allocBasisPoints: Number(event.allocBasisPoints),
    isAgentPool: event.isAgentPool,
    personaTokenId: null,
    isActive: true,
    totalStaked: 0n,
    accAmicaPerShare: 0n,
    lastRewardBlock: blockNumber,
    createdAt: timestamp,
    createdAtBlock: blockNumber,
  })
  
  await ctx.store.insert(pool)
  
  ctx.log.info(`Staking pool ${poolId} added: ${event.lpToken}`)
}

export async function handlePoolUpdated(
  ctx: Context,
  log: Log
) {
  const event = stakingAbi.events.PoolUpdated.decode(log)
  
  const poolId = event.poolId.toString()
  const pool = await ctx.store.get(StakingPool, poolId)
  
  if (!pool) {
    ctx.log.error(`Pool not found: ${poolId}`)
    return
  }
  
  pool.allocBasisPoints = Number(event.allocBasisPoints)
  pool.isActive = event.isActive
  await ctx.store.save(pool)
  
  ctx.log.info(`Pool ${poolId} updated: allocation=${event.allocBasisPoints}, active=${event.isActive}`)
}

export async function handleStakingDeposit(
  ctx: Context,
  log: Log,
  timestamp: Date
) {
  const event = stakingAbi.events.Deposit.decode(log)
  
  const poolId = event.poolId.toString()
  const pool = await ctx.store.get(StakingPool, poolId)
  
  if (!pool) {
    ctx.log.error(`Pool not found: ${poolId}`)
    return
  }
  
  const stakeId = `${poolId}-${event.user.toLowerCase()}`
  let stake = await ctx.store.get(UserStake, stakeId)
  
  if (!stake) {
    stake = new UserStake({
      id: stakeId,
      pool,
      user: event.user.toLowerCase(),
      flexibleAmount: 0n,
      lockedAmount: 0n,
      unclaimedRewards: 0n,
      firstStakeAt: timestamp,
      lastStakeAt: timestamp,
    })
  }
  
  stake.flexibleAmount = stake.flexibleAmount + event.amount
  stake.lastStakeAt = timestamp
  await ctx.store.save(stake)
  
  // Update pool totals
  pool.totalStaked = pool.totalStaked + event.amount
  await ctx.store.save(pool)
  
  ctx.log.info(`Staking deposit: ${event.amount} to pool ${poolId} by ${event.user}`)
}

export async function handleStakingDepositLocked(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = stakingAbi.events.DepositLocked.decode(log)
  
  const poolId = event.poolId.toString()
  const pool = await ctx.store.get(StakingPool, poolId)
  
  if (!pool) {
    ctx.log.error(`Pool not found: ${poolId}`)
    return
  }
  
  const stakeId = `${poolId}-${event.user.toLowerCase()}`
  let stake = await ctx.store.get(UserStake, stakeId)
  
  if (!stake) {
    stake = new UserStake({
      id: stakeId,
      pool,
      user: event.user.toLowerCase(),
      flexibleAmount: 0n,
      lockedAmount: 0n,
      unclaimedRewards: 0n,
      firstStakeAt: timestamp,
      lastStakeAt: timestamp,
    })
  }
  
  stake.lockedAmount = stake.lockedAmount + event.amount
  stake.lastStakeAt = timestamp
  await ctx.store.save(stake)
  
  // Create lock entry
  const lockId = `${poolId}-${event.user.toLowerCase()}-${event.lockId}`
  
  const lock = new StakeLock({
    id: lockId,
    userStake: stake,
    lockId: event.lockId,
    amount: event.amount,
    unlockTime: new Date(Number(event.unlockTime) * 1000),
    lockMultiplier: Number(event.multiplier),
    createdAt: timestamp,
    createdAtBlock: blockNumber,
    isWithdrawn: false,
  })
  
  await ctx.store.insert(lock)
  
  // Update pool totals
  pool.totalStaked = pool.totalStaked + event.amount
  await ctx.store.save(pool)
  
  ctx.log.info(`Locked staking deposit: ${event.amount} to pool ${poolId} until ${event.unlockTime}`)
}

export async function handleStakingWithdraw(
  ctx: Context,
  log: Log
) {
  const event = stakingAbi.events.Withdraw.decode(log)
  
  const poolId = event.poolId.toString()
  const pool = await ctx.store.get(StakingPool, poolId)
  
  if (!pool) {
    ctx.log.error(`Pool not found: ${poolId}`)
    return
  }
  
  const stakeId = `${poolId}-${event.user.toLowerCase()}`
  const stake = await ctx.store.get(UserStake, stakeId)
  
  if (!stake) {
    ctx.log.error(`Stake not found: ${stakeId}`)
    return
  }
  
  stake.flexibleAmount = stake.flexibleAmount - event.amount
  await ctx.store.save(stake)
  
  // Update pool totals
  pool.totalStaked = pool.totalStaked - event.amount
  await ctx.store.save(pool)
  
  ctx.log.info(`Staking withdraw: ${event.amount} from pool ${poolId} by ${event.user}`)
}

export async function handleStakingWithdrawLocked(
  ctx: Context,
  log: Log
) {
  const event = stakingAbi.events.WithdrawLocked.decode(log)
  
  const poolId = event.poolId.toString()
  const pool = await ctx.store.get(StakingPool, poolId)
  
  if (!pool) {
    ctx.log.error(`Pool not found: ${poolId}`)
    return
  }
  
  const stakeId = `${poolId}-${event.user.toLowerCase()}`
  const stake = await ctx.store.get(UserStake, stakeId)
  
  if (!stake) {
    ctx.log.error(`Stake not found: ${stakeId}`)
    return
  }
  
  // Find and update the lock
  const locks = await ctx.store.find(StakeLock, {
    where: {
      userStake: { id: stakeId },
      lockId: event.lockId,
      isWithdrawn: false
    }
  })
  
  if (locks.length > 0) {
    const lock = locks[0]
    lock.isWithdrawn = true
    await ctx.store.save(lock)
    
    stake.lockedAmount = stake.lockedAmount - event.amount
    await ctx.store.save(stake)
    
    // Update pool totals
    pool.totalStaked = pool.totalStaked - event.amount
    await ctx.store.save(pool)
  }
  
  ctx.log.info(`Locked staking withdraw: ${event.amount} from pool ${poolId} lock ${event.lockId}`)
}

export async function handleRewardsClaimed(
  ctx: Context,
  log: Log,
  timestamp: Date,
  blockNumber: bigint
) {
  const event = stakingAbi.events.RewardsClaimed.decode(log)
  
  const claimId = `${log.transactionHash}-${log.logIndex}`
  
  const claim = new StakingRewardClaim({
    id: claimId,
    user: event.user.toLowerCase(),
    totalAmount: event.amount,
    timestamp,
    block: blockNumber,
    txHash: log.transactionHash,
  })
  
  await ctx.store.insert(claim)
  
  ctx.log.info(`Staking rewards claimed: ${event.amount} by ${event.user}`)
}
