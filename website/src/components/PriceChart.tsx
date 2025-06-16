// src/components/PriceChart.tsx
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery, gql } from '@apollo/client';
import { formatEther } from 'viem';

interface PriceChartProps {
  chainId: string;
  tokenId: string;
}

interface ChartData {
  date: string;
  volume: string;
  trades: number;
  uniqueTraders?: number;
}

interface Trade {
  id: string;
  timestamp: string;
  amountIn: string;
  trader: string;
}

// Updated query to use BigInt for tokenId
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
      volume
      uniqueTraders
    }

    # Also get recent trades for fallback data
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
    }
  }
`;

// Helper function to generate mock data for development
const generateMockChartData = (days: number): ChartData[] => {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    const baseVolume = 50 + Math.random() * 100;
    return {
      date: date.toISOString(),
      volume: (baseVolume * 1e18).toString(),
      trades: Math.floor(10 + Math.random() * 50),
      uniqueTraders: Math.floor(5 + Math.random() * 20)
    };
  });
};

// Helper to aggregate trades into daily stats if PersonaDailyStats is empty
const aggregateTradesIntoDailyStats = (trades: Trade[], days: number): ChartData[] => {
  const dailyData: Record<string, { volume: bigint; trades: number; traders: Set<string> }> = {};
  
  // Initialize days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString().split('T')[0];
    dailyData[dateKey] = { volume: BigInt(0), trades: 0, traders: new Set() };
  }
  
  // Aggregate trades
  trades.forEach(trade => {
    const date = new Date(trade.timestamp);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString().split('T')[0];
    
    if (dailyData[dateKey]) {
      dailyData[dateKey].volume += BigInt(trade.amountIn);
      dailyData[dateKey].trades += 1;
      dailyData[dateKey].traders.add(trade.trader);
    }
  });
  
  // Convert to array and sort by date
  return Object.entries(dailyData)
    .map(([date, data]) => ({
      date: new Date(date).toISOString(),
      volume: data.volume.toString(),
      trades: data.trades,
      uniqueTraders: data.traders.size
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export default function PriceChart({ chainId, tokenId }: PriceChartProps) {
  const [days, setDays] = useState(7);
  const personaId = `${chainId}-${tokenId}`;
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
  
  // Convert tokenId to BigInt string for GraphQL
  const tokenIdBigInt = tokenId.replace(/^0+/, '') || '0';
  
  // Fetch data from GraphQL
  const { data, loading, error } = useQuery(GET_PERSONA_DAILY_STATS, {
    variables: {
      tokenId: tokenIdBigInt, // Pass as string representation of BigInt
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
    trades: item.trades,
    uniqueTraders: item.uniqueTraders || 0
  }));

  // Calculate summary statistics
  const totalVolume = chartData.reduce((sum, item) => sum + BigInt(item.volume), BigInt(0));
  const totalTrades = chartData.reduce((sum, item) => sum + item.trades, 0);
  const avgDailyVolume = chartData.length > 0 ? totalVolume / BigInt(chartData.length) : BigInt(0);

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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-light text-white">Volume Chart</h2>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
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

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-1">Total Volume</p>
          <p className="text-lg font-light text-white">{formatEther(totalVolume)} ETH</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-1">Total Trades</p>
          <p className="text-lg font-light text-white">{totalTrades}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-1">Avg Daily Volume</p>
          <p className="text-lg font-light text-white">{formatEther(avgDailyVolume)} ETH</p>
        </div>
      </div>

      {formattedData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
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
              formatter={(value: number | string, name: string) => {
                if (name === 'Volume (ETH)' && typeof value === 'number') return `${value.toFixed(4)} ETH`;
                return value;
              }}
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
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-white/50">No trading data available for this period</p>
        </div>
      )}

      {/* Additional Info */}
      <div className="mt-4 p-3 bg-blue-500/10 backdrop-blur-sm rounded-lg text-xs border border-blue-500/20">
        <p className="font-light text-white/90 mb-1">Chart Information:</p>
        <ul className="text-white/70 space-y-0.5 ml-4 list-disc">
          <li>Volume data shows AMICA traded on the bonding curve</li>
          <li>Data is aggregated daily from all trades</li>
          {data?.personaDailyStats?.length === 0 && data?.recentTrades?.length > 0 && (
            <li>Chart generated from recent trade history</li>
          )}
          {isMockMode && <li className="text-purple-400">Using mock data for demonstration</li>}
        </ul>
      </div>
    </div>
  );
}
