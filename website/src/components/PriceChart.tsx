// src/components/PriceChart.tsx - Enhanced with buy/sell volume separation
import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery, gql } from '@apollo/client';
import { formatEther } from 'viem';

interface PriceChartProps {
  chainId: string;
  tokenId: string;
}

interface ChartData {
  date: string;
  volume: string;
  buyVolume?: string;
  sellVolume?: string;
  trades: number;
  buyTrades?: number;
  sellTrades?: number;
  uniqueTraders?: number;
}

interface Trade {
  id: string;
  timestamp: string;
  amountIn: string;
  trader: string;
  isBuy: boolean;
}

// Enhanced query with buy/sell separation
const GET_PERSONA_DAILY_STATS = gql`
  query GetPersonaDailyStats($tokenId: BigInt!, $chainId: Int!, $days: Int = 30) {
    personaDailyStats(
      where: {
        persona: {
          tokenId_eq: $tokenId,
          chainId_eq: $chainId
        }
      }
      orderBy: date_DESC
      limit: $days
    ) {
      id
      date
      trades
      buyTrades
      sellTrades
      volume
      buyVolume
      sellVolume
      uniqueTraders
    }

    # Also get recent trades for fallback data and real-time updates
    recentTrades: trades(
      where: {
        persona: {
          tokenId_eq: $tokenId,
          chainId_eq: $chainId
        }
      }
      orderBy: timestamp_DESC
      limit: 100
    ) {
      id
      timestamp
      amountIn
      trader
      isBuy
    }
  }
`;

// Helper function to generate mock data for development
const generateMockChartData = (days: number): ChartData[] => {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    const baseBuyVolume = 30 + Math.random() * 70;
    const baseSellVolume = 20 + Math.random() * 50;
    const buyTrades = Math.floor(5 + Math.random() * 25);
    const sellTrades = Math.floor(3 + Math.random() * 20);
    
    return {
      date: date.toISOString(),
      volume: ((baseBuyVolume + baseSellVolume) * 1e18).toString(),
      buyVolume: (baseBuyVolume * 1e18).toString(),
      sellVolume: (baseSellVolume * 1e18).toString(),
      trades: buyTrades + sellTrades,
      buyTrades,
      sellTrades,
      uniqueTraders: Math.floor(3 + Math.random() * 15)
    };
  });
};

// Helper to aggregate trades into daily stats if PersonaDailyStats is empty
const aggregateTradesIntoDailyStats = (trades: Trade[], days: number): ChartData[] => {
  const dailyData: Record<string, { 
    buyVolume: bigint; 
    sellVolume: bigint; 
    buyTrades: number; 
    sellTrades: number; 
    traders: Set<string> 
  }> = {};
  
  // Initialize days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString().split('T')[0];
    dailyData[dateKey] = { 
      buyVolume: BigInt(0), 
      sellVolume: BigInt(0), 
      buyTrades: 0, 
      sellTrades: 0, 
      traders: new Set() 
    };
  }
  
  // Aggregate trades
  trades.forEach(trade => {
    const date = new Date(trade.timestamp);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString().split('T')[0];
    
    if (dailyData[dateKey]) {
      if (trade.isBuy) {
        dailyData[dateKey].buyVolume += BigInt(trade.amountIn);
        dailyData[dateKey].buyTrades += 1;
      } else {
        dailyData[dateKey].sellVolume += BigInt(trade.amountIn);
        dailyData[dateKey].sellTrades += 1;
      }
      dailyData[dateKey].traders.add(trade.trader);
    }
  });
  
  // Convert to array and sort by date
  return Object.entries(dailyData)
    .map(([date, data]) => ({
      date: new Date(date).toISOString(),
      volume: (data.buyVolume + data.sellVolume).toString(),
      buyVolume: data.buyVolume.toString(),
      sellVolume: data.sellVolume.toString(),
      trades: data.buyTrades + data.sellTrades,
      buyTrades: data.buyTrades,
      sellTrades: data.sellTrades,
      uniqueTraders: data.traders.size
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export default function PriceChart({ chainId, tokenId }: PriceChartProps) {
  const [days, setDays] = useState(7);
  const [chartType, setChartType] = useState<'volume' | 'trades' | 'combined'>('volume');
  const [showBuySell, setShowBuySell] = useState(true);
  const personaId = `${chainId}-${tokenId}`;
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
  
  // Convert tokenId to BigInt string for GraphQL
  const tokenIdBigInt = tokenId.replace(/^0+/, '') || '0';
  
  // Fetch data from GraphQL
  const { data, loading, error } = useQuery(GET_PERSONA_DAILY_STATS, {
    variables: {
      tokenId: tokenIdBigInt,
      chainId: parseInt(chainId),
      days
    },
    skip: !chainId || !tokenId,
    fetchPolicy: 'cache-and-network',
  });

  // Process the data
  const chartData: ChartData[] = (() => {
    if (isMockMode) {
      return generateMockChartData(days);
    }
    
    if (!data) return [];
    
    // If we have PersonaDailyStats, use them
    if (data.personaDailyStats && data.personaDailyStats.length > 0) {
      // Reverse to show oldest first
      return [...data.personaDailyStats].reverse();
    }
    
    // Otherwise, aggregate from recent trades
    if (data.recentTrades && data.recentTrades.length > 0) {
      return aggregateTradesIntoDailyStats(data.recentTrades, days);
    }
    
    return [];
  })();

  // Format data for the chart
  const formattedData = chartData.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    volume: parseFloat(formatEther(BigInt(item.volume))),
    buyVolume: item.buyVolume ? parseFloat(formatEther(BigInt(item.buyVolume))) : 0,
    sellVolume: item.sellVolume ? parseFloat(formatEther(BigInt(item.sellVolume))) : 0,
    trades: item.trades,
    buyTrades: item.buyTrades || 0,
    sellTrades: item.sellTrades || 0,
    uniqueTraders: item.uniqueTraders || 0
  }));

  // Calculate summary statistics
  const totalVolume = chartData.reduce((sum, item) => sum + BigInt(item.volume), BigInt(0));
  const totalBuyVolume = chartData.reduce((sum, item) => sum + BigInt(item.buyVolume || '0'), BigInt(0));
  const totalSellVolume = chartData.reduce((sum, item) => sum + BigInt(item.sellVolume || '0'), BigInt(0));
  const totalTrades = chartData.reduce((sum, item) => sum + item.trades, 0);
  const totalBuyTrades = chartData.reduce((sum, item) => sum + (item.buyTrades || 0), 0);
  const totalSellTrades = chartData.reduce((sum, item) => sum + (item.sellTrades || 0), 0);
  const avgDailyVolume = chartData.length > 0 ? totalVolume / BigInt(chartData.length) : BigInt(0);
  const buyPercentage = totalVolume > BigInt(0) ? (Number(totalBuyVolume) / Number(totalVolume)) * 100 : 50;

  if (loading && !data) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-white/10 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error loading chart data</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4">
        <h2 className="text-xl font-light text-white">Trading Analytics</h2>
        
        <div className="flex flex-wrap gap-2">
          {/* Chart Type Selector */}
          <div className="flex gap-1 bg-white/10 rounded-lg p-1">
            {(['volume', 'trades', 'combined'] as const).map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1 rounded text-xs transition-colors capitalize ${
                  chartType === type
                    ? 'bg-purple-500/50 text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Buy/Sell Toggle */}
          <button
            onClick={() => setShowBuySell(!showBuySell)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              showBuySell
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Buy/Sell Split
          </button>

          {/* Time Period Selector */}
          <div className="flex gap-1">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  days === d
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-1">Total Volume</p>
          <p className="text-lg font-light text-white">{formatEther(totalVolume)} ETH</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-1">Buy Volume</p>
          <p className="text-lg font-light text-green-400">{formatEther(totalBuyVolume)} ETH</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-1">Sell Volume</p>
          <p className="text-lg font-light text-red-400">{formatEther(totalSellVolume)} ETH</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-1">Total Trades</p>
          <p className="text-lg font-light text-white">{totalTrades}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-1">Buy/Sell Ratio</p>
          <p className="text-lg font-light text-white">{buyPercentage.toFixed(0)}%/{ (100 - buyPercentage).toFixed(0)}%</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-1">Avg Daily</p>
          <p className="text-lg font-light text-white">{formatEther(avgDailyVolume)} ETH</p>
        </div>
      </div>

      {formattedData.length > 0 ? (
        <div className="h-80">
          {chartType === 'volume' && (
            <ResponsiveContainer width="100%" height="100%">
              {showBuySell ? (
                <BarChart data={formattedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  />
                  <Legend />
                  <Bar dataKey="buyVolume" stackId="volume" fill="#10b981" name="Buy Volume (ETH)" />
                  <Bar dataKey="sellVolume" stackId="volume" fill="#ef4444" name="Sell Volume (ETH)" />
                </BarChart>
              ) : (
                <LineChart data={formattedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    stroke="#a855f7"
                    strokeWidth={2}
                    name="Volume (ETH)"
                    dot={{ fill: '#a855f7', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}

          {chartType === 'trades' && (
            <ResponsiveContainer width="100%" height="100%">
              {showBuySell ? (
                <BarChart data={formattedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  />
                  <Legend />
                  <Bar dataKey="buyTrades" stackId="trades" fill="#10b981" name="Buy Trades" />
                  <Bar dataKey="sellTrades" stackId="trades" fill="#ef4444" name="Sell Trades" />
                </BarChart>
              ) : (
                <LineChart data={formattedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="trades"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    name="Trades"
                    dot={{ fill: '#06b6d4', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}

          {chartType === 'combined' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.5)"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  yAxisId="volume"
                  stroke="rgba(255,255,255,0.5)"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  yAxisId="trades"
                  orientation="right"
                  stroke="rgba(255,255,255,0.5)"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                />
                <Legend />
                <Line
                  yAxisId="volume"
                  type="monotone"
                  dataKey="volume"
                  stroke="#a855f7"
                  strokeWidth={2}
                  name="Volume (ETH)"
                  dot={{ fill: '#a855f7', r: 3 }}
                />
                <Line
                  yAxisId="trades"
                  type="monotone"
                  dataKey="trades"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  name="Trades"
                  dot={{ fill: '#06b6d4', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : (
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-white/50">No trading data available for this period</p>
        </div>
      )}

      {/* Additional Info */}
      <div className="mt-4 p-3 bg-blue-500/10 backdrop-blur-sm rounded-lg text-xs border border-blue-500/20">
        <p className="font-light text-white/90 mb-1">Chart Information:</p>
        <ul className="text-white/70 space-y-0.5 ml-4 list-disc">
          <li>Volume data shows {showBuySell ? 'buy (green) and sell (red) volumes' : 'total volume'} on the bonding curve</li>
          <li>Data is aggregated daily from all trades with buy/sell classification</li>
          <li>Buy trades use pairing tokens to purchase persona tokens</li>
          <li>Sell trades use persona tokens to get pairing tokens back</li>
          {data?.personaDailyStats?.length === 0 && data?.recentTrades?.length > 0 && (
            <li>Chart generated from recent trade history with buy/sell analysis</li>
          )}
          {isMockMode && <li className="text-purple-400">Using mock data for demonstration</li>}
        </ul>
      </div>
    </div>
  );
}
