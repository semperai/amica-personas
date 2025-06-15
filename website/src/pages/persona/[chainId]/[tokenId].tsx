// src/pages/persona/[chainId]/[tokenId].tsx
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { formatEther } from 'viem';
import Layout from '@/components/Layout';
import PersonaMetadata from '@/components/PersonaMetadata';
import TradingInterface from '@/components/TradingInterface';
import PriceChart from '@/components/PriceChart';
import AgentDeposits from '@/components/AgentDeposits';
import { fetchPersonaTrades } from '@/lib/api';

// Trade interface
interface Trade {
  id: string;
  trader: string;
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  timestamp: string;
  block: string;
  txHash: string;
}

// Create TradeHistory component
const TradeHistory = ({ chainId, tokenId }: { chainId: string; tokenId: string }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadTrades = async () => {
      try {
        setError(false);
        const data = await fetchPersonaTrades(chainId, tokenId, 10);
        setTrades(data.trades || []);
      } catch (error) {
        console.error('Failed to load trades:', error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadTrades();
  }, [chainId, tokenId]);

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-light text-white mb-4">Recent Trades</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/10 rounded"></div>
          <div className="h-4 bg-white/10 rounded"></div>
          <div className="h-4 bg-white/10 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-light text-white mb-4">Recent Trades</h3>
        <p className="text-white/50">Unable to load trades</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <h3 className="text-lg font-light text-white mb-4">Recent Trades</h3>
      {trades.length === 0 ? (
        <p className="text-white/50">No trades yet</p>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => (
            <div key={trade.id} className="border-b border-white/10 pb-3 last:border-b-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-white">
                    {trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}
                  </p>
                  <p className="text-xs text-white/50">
                    {new Date(trade.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/80">
                    {formatEther(BigInt(trade.amountIn))} AMICA
                  </p>
                  <p className="text-xs text-white/60">
                    {formatEther(BigInt(trade.amountOut))} tokens
                  </p>
                  {BigInt(trade.feeAmount) > 0 && (
                    <p className="text-xs text-purple-400">
                      Fee: {formatEther(BigInt(trade.feeAmount))} AMICA
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PersonaDetailPage: NextPage = () => {
  const router = useRouter();
  const { chainId, tokenId } = router.query;

  // Handle loading state while router params are being resolved
  if (!router.isReady || !chainId || !tokenId) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </Layout>
    );
  }

  // Ensure we have string values
  const chainIdStr = Array.isArray(chainId) ? chainId[0] : chainId;
  const tokenIdStr = Array.isArray(tokenId) ? tokenId[0] : tokenId;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            <PersonaMetadata chainId={chainIdStr} tokenId={tokenIdStr} />
            <PriceChart chainId={chainIdStr} tokenId={tokenIdStr} />
            <AgentDeposits chainId={chainIdStr} tokenId={tokenIdStr} />
          </div>

          {/* Right column - 1/3 width */}
          <div className="lg:col-span-1 space-y-6">
            <TradingInterface chainId={chainIdStr} tokenId={tokenIdStr} />
            <TradeHistory chainId={chainIdStr} tokenId={tokenIdStr} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PersonaDetailPage;
