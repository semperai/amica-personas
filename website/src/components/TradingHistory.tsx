import { useQuery } from '@apollo/client';
import { formatEther } from 'viem';
import { GET_USER_PORTFOLIO } from '@/lib/graphql/client';

interface TradingHistoryProps {
  address: string;
}

interface Trade {
  id: string;
  persona?: {
    id: string;
    name: string;
    symbol: string;
  };
  amountIn: string;
  amountOut: string;
  timestamp: string;
  txHash: string;
}

// Extract chain info from persona ID
const extractChainFromId = (id: string) => {
  const [chainId] = id.split('-');
  const chainNames: Record<string, string> = {
    '1': 'ethereum',
    '8453': 'base',
    '42161': 'arbitrum'
  };
  return {
    id: chainId,
    name: chainNames[chainId] || 'unknown'
  };
};

export function TradingHistory({ address }: TradingHistoryProps) {
  const { data, loading, error } = useQuery(GET_USER_PORTFOLIO, {
    variables: { creator: address.toLowerCase() },
    skip: !address,
    fetchPolicy: 'network-only',
  });

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">Recent Trades</h2>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">Recent Trades</h2>
        <div className="text-center py-12">
          <p className="text-red-400">Error loading trades</p>
        </div>
      </div>
    );
  }

  const trades = data?.userTrades || [];

  if (trades.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">Recent Trades</h2>
        <div className="text-center py-12">
          <p className="text-white/60">No trading history yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-light text-white mb-6">Recent Trades</h2>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 backdrop-blur-sm">
              <th className="px-6 py-4 text-left text-sm font-medium text-white/80">Persona</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-white/80">Amount In</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-white/80">Tokens Out</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-white/80">Date</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-white/80">Chain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {trades.map((trade: Trade) => {
              const chain = trade.persona ? extractChainFromId(trade.persona.id) : null;
              return (
                <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    {trade.persona ? (
                      <div>
                        <p className="font-medium text-white">{trade.persona.name}</p>
                        <p className="text-sm text-white/60">${trade.persona.symbol}</p>
                      </div>
                    ) : (
                      <p className="text-white/40">Unknown</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-white/80">
                    {formatEther(BigInt(trade.amountIn))} ETH
                  </td>
                  <td className="px-6 py-4 text-white/80">
                    {formatEther(BigInt(trade.amountOut))}
                  </td>
                  <td className="px-6 py-4 text-white/80">
                    {new Date(trade.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-white/60">
                      {chain?.name || 'Unknown'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
