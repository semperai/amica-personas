import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchVolumeChart } from '../lib/api';

interface PriceChartProps {
  chainId: string;
  tokenId: string;
}

interface ChartData {
  date: string;
  volume: string;
  trades: number;
}

export default function PriceChart({ chainId, tokenId }: PriceChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    const loadChart = async () => {
      try {
        const data = await fetchVolumeChart(chainId, tokenId, days);
        setChartData(data);
      } catch (error) {
        console.error('Error loading chart:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChart();
  }, [chainId, tokenId, days]);

  if (loading) return <div>Loading chart...</div>;

  const formattedData = chartData.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    volume: parseFloat((BigInt(item.volume) / BigInt(1e18)).toString()),
    trades: item.trades
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Volume Chart</h2>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded ${
                days === d ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="volume" stroke="#3B82F6" name="Volume (ETH)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
