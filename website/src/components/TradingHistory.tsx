import { useState, useEffect } from 'react';
import { fetchUserPortfolio } from '../lib/api';
import { formatEther } from 'viem';

interface TradingHistoryProps {
  address: string;
}

interface Trade {
  persona: {
    id: string;
    name: string;
    symbol: string;
  };
  amountIn: string;
  amountOut: string;
  timestamp: string;
  chain: {
    id: string;
    name: string;
  };
}

export function TradingHistory({ address }: TradingHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await fetchUserPortfolio(address);
        setTrades(data.recentTrades || []);
      } catch (error) {
        console.error('Error loading history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [address]);

  if (loading) return <div>Loading trading history...</div>;

  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        No trading history yet.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Recent Trades</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Persona</th>
              <th className="px-4 py-2 text-left">Amount In</th>
              <th className="px-4 py-2 text-left">Tokens Out</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Chain</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, index) => (
              <tr key={index} className="border-t">
                <td className="px-4 py-2">
                  <div>
                    <p className="font-medium">{trade.persona.name}</p>
                    <p className="text-sm text-gray-500">${trade.persona.symbol}</p>
                  </div>
                </td>
                <td className="px-4 py-2">{formatEther(BigInt(trade.amountIn))} ETH</td>
                <td className="px-4 py-2">{formatEther(BigInt(trade.amountOut))}</td>
                <td className="px-4 py-2">
                  {new Date(trade.timestamp).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">{trade.chain.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
