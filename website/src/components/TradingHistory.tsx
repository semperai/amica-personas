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
        <h2 className="text-2xl font-semibold text-foreground mb-6">Recent Trades</h2>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-6">Recent Trades</h2>
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
        <h2 className="text-2xl font-semibold text-foreground mb-6">Recent Trades</h2>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No trading history yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-foreground mb-6">Recent Trades</h2>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="bg-muted backdrop-blur-sm">
              <th className="px-6 py-4 text-left text-sm font-medium text-foreground/80">Persona</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-foreground/80">Amount In</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-foreground/80">Tokens Out</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-foreground/80">Date</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-foreground/80">Chain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {trades.map((trade: Trade) => {
              const chain = trade.persona ? extractChainFromId(trade.persona.id) : null;
              return (
                <tr key={trade.id} className="hover:bg-muted transition-colors">
                  <td className="px-6 py-4">
                    {trade.persona ? (
                      <div>
                        <p className="font-medium text-foreground">{trade.persona.name}</p>
                        <p className="text-sm text-muted-foreground">${trade.persona.symbol}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Unknown</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-foreground/80">
                    {formatEther(BigInt(trade.amountIn))} ETH
                  </td>
                  <td className="px-6 py-4 text-foreground/80">
                    {formatEther(BigInt(trade.amountOut))}
                  </td>
                  <td className="px-6 py-4 text-foreground/80">
                    {new Date(trade.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-muted-foreground">
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
