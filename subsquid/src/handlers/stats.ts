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
      totalBuyTrades: 0,
      totalSellTrades: 0,
      totalVolume: 0n,
      totalBuyVolume: 0n,
      totalSellVolume: 0n,
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
  
  // Separate buy and sell trades
  const buyTrades = trades.filter(t => t.isBuy)
  const sellTrades = trades.filter(t => !t.isBuy)
  
  stats.totalBuyTrades = buyTrades.length
  stats.totalSellTrades = sellTrades.length
  
  // For buy trades: amountIn is pairing tokens spent
  stats.totalBuyVolume = buyTrades.reduce((sum, t) => sum + t.amountIn, 0n)
  
  // For sell trades: amountOut is pairing tokens received
  stats.totalSellVolume = sellTrades.reduce((sum, t) => sum + t.amountOut, 0n)
  
  // Total volume is buy volume + sell volume (all in pairing token terms)
  stats.totalVolume = stats.totalBuyVolume + stats.totalSellVolume
  
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
  
  ctx.log.info(`Updated global stats: ${stats.totalPersonas} personas, ${stats.totalTrades} trades (${stats.totalBuyTrades} buys, ${stats.totalSellTrades} sells)`)
}

export async function updateDailyStats(ctx: Context, dateStr: string) {
  let stats = await ctx.store.get(DailyStats, dateStr)
  
  if (!stats) {
    stats = new DailyStats({
      id: dateStr,
      date: new Date(dateStr),
      newPersonas: 0,
      trades: 0,
      buyTrades: 0,
      sellTrades: 0,
      volume: 0n,
      buyVolume: 0n,
      sellVolume: 0n,
      uniqueTraders: 0,
      bridgeVolume: 0n,
    })
  }
  
  const startOfDay = new Date(dateStr)
  const endOfDay = new Date(dateStr)
  endOfDay.setDate(endOfDay.getDate() + 1)
  
  // Count new personas - fix the query
  const newPersonas = await ctx.store.find(Persona, {
    where: {
      createdAt: Between(startOfDay, endOfDay)
    }
  })
  stats.newPersonas = newPersonas.length
  
  // Count trades - fix the query
  const trades = await ctx.store.find(Trade, {
    where: {
      timestamp: Between(startOfDay, endOfDay)
    }
  })
  
  stats.trades = trades.length
  
  // Separate buy and sell trades
  const buyTrades = trades.filter(t => t.isBuy)
  const sellTrades = trades.filter(t => !t.isBuy)
  
  stats.buyTrades = buyTrades.length
  stats.sellTrades = sellTrades.length
  
  // Calculate volumes
  stats.buyVolume = buyTrades.reduce((sum, t) => sum + t.amountIn, 0n)
  stats.sellVolume = sellTrades.reduce((sum, t) => sum + t.amountOut, 0n)
  stats.volume = stats.buyVolume + stats.sellVolume
  
  stats.uniqueTraders = new Set(trades.map(t => t.trader)).size
  
  // Count bridge volume - fix the query
  const bridgeActivities = await ctx.store.find(BridgeActivity, {
    where: {
      timestamp: Between(startOfDay, endOfDay),
      action: BridgeAction.WRAP
    }
  })
  stats.bridgeVolume = bridgeActivities.reduce((sum, a) => sum + a.amount, 0n)
  
  await ctx.store.save(stats)
  
  ctx.log.info(`Updated daily stats for ${dateStr}: ${stats.trades} trades (${stats.buyTrades} buys, ${stats.sellTrades} sells), volume: ${stats.volume}`)
}
