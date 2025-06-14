if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
        <p className="text-gray-500">Unable to load trades</p>
      </div>
    );
  }import { useRouter } from 'next/router';
import { NextPage } from 'next';
import Layout from '@/components/Layout';
import PersonaMetadata from '@/components/PersonaMetadata';
import TradingInterface from '@/components/TradingInterface';
import PriceChart from '@/components/PriceChart';

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <PersonaMetadata chainId={chainIdStr} tokenId={tokenIdStr} />
          <PriceChart chainId={chainIdStr} tokenId={tokenIdStr} />
        </div>
        <div>
          <TradingInterface chainId={chainIdStr} tokenId={tokenIdStr} />
          <TradeHistory chainId={chainIdStr} tokenId={tokenIdStr} />
        </div>
      </div>
    </Layout>
  );
};

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
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
        <p className="text-gray-500">Unable to load trades</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
      {trades.length === 0 ? (
        <p className="text-gray-500">No trades yet</p>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => (
            <div key={trade.id} className="border-b pb-3 last:border-b-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">
                    {trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(trade.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    {formatEther(BigInt(trade.amountIn))} AMICA
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatEther(BigInt(trade.amountOut))} tokens
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import { useState, useEffect } from 'react';
import { formatEther } from 'viem';
import { fetchPersonaTrades } from '@/lib/api';

export default PersonaDetailPage;
