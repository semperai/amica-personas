import { Context } from '../processor'
import {
  GlobalStats,
  DailyStats,
  Persona,
  Trade,
  StakingPool,
  BridgeActivity,
  BridgeAction
} from '../model'
import { Between, And, MoreThanOrEqual, LessThan } from 'typeorm'


export async function updateGlobalStats(ctx: Context) {
  let stats = await ctx.store.get(GlobalStats, 'global')
  
  if (!stats) {
    stats = new GlobalStats({
      id: 'global',
      totalPersonas: 0,
      totalTrades: 0,
      totalVolume: 0n,
      totalStakingPools: 0,
      totalStaked: 0n,
      totalBridgeVolume: 0n,
      lastUpdated: new Date(),
    })
  }
  
  // Count total personas
  const personas = await ctx.store.findBy(Persona, {})
  stats.totalPersonas = personas.length
  
  // Count total trades and volume
  const trades = await ctx.store.findBy(Trade, {})
  stats.totalTrades = trades.length
  stats.totalVolume = trades.reduce((sum, t) => sum + t.amountIn, 0n)
  
  // Count staking pools and total staked
  const pools = await ctx.store.findBy(StakingPool, {})
  stats.totalStakingPools = pools.length
  stats.totalStaked = pools.reduce((sum, p) => sum + p.totalStaked, 0n)
  
  // Calculate bridge volume
  const bridgeActivities = await ctx.store.findBy(BridgeActivity, {
    action: BridgeAction.WRAP
  })
  stats.totalBridgeVolume = bridgeActivities.reduce((sum, a) => sum + a.amount, 0n)
  
  stats.lastUpdated = new Date()
  
  await ctx.store.save(stats)
  
  ctx.log.info(`Updated global stats: ${stats.totalPersonas} personas, ${stats.totalTrades} trades`)
}

export async function updateDailyStats(ctx: Context, dateStr: string) {
  let stats = await ctx.store.get(DailyStats, dateStr)
  
  if (!stats) {
    stats = new DailyStats({
      id: dateStr,
      date: new Date(dateStr),
      newPersonas: 0,
      trades: 0,
      volume: 0n,
      uniqueTraders: 0,
      bridgeVolume: 0n,
    })
  }
  
  const startOfDay = new Date(dateStr)
  const endOfDay = new Date(dateStr)
  endOfDay.setDate(endOfDay.getDate() + 1)
  
  // Count new personas
  const newPersonas = await ctx.store.findBy(Persona, {
    createdAt: MoreThanOrEqual(startOfDay) && LessThan(endOfDay)
  })
  stats.newPersonas = newPersonas.length
  
  // Count trades
  const trades = await ctx.store.find(Trade, {
    where: {
      timestamp: And(
        MoreThanOrEqual(startOfDay),
        LessThan(endOfDay)
      )
    }
  })
  stats.trades = trades.length
  stats.volume = trades.reduce((sum, t) => sum + t.amountIn, 0n)
  stats.uniqueTraders = new Set(trades.map(t => t.trader)).size
  
  // Count bridge volume
  const bridgeActivities = await ctx.store.find(BridgeActivity, {
    where: {
      timestamp: And(
        MoreThanOrEqual(startOfDay),
        LessThan(endOfDay)
      ),
      action: BridgeAction.WRAP
    }
  })
  stats.bridgeVolume = bridgeActivities.reduce((sum, a) => sum + a.amount, 0n)
  
  await ctx.store.save(stats)
  
  ctx.log.info(`Updated daily stats for ${dateStr}: ${stats.trades} trades, volume: ${stats.volume}`)
}
