import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { formatEther } from 'viem';
import { fetchTrending } from '@/lib/api';

interface TrendingPersona {
  id: string;
  name: string;
  symbol: string;
  creator: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  totalTrades24h: number;
  uniqueTraders24h: number;
  growthMultiplier: number;
  daysActive: number;
  isGraduated: boolean;
  chain: {
    id: string;
    name: string;
  };
}

export default function TrendingPage() {
  const [trending, setTrending] = useState<TrendingPersona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrending = async () => {
      try {
        const data = await fetchTrending();
        setTrending(data);
      } catch (error) {
        console.error('Error loading trending:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTrending();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔥 Trending Personas</h1>
        <p className="text-gray-600">Personas with the highest volume growth compared to their average</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {trending.map((persona, index) => (
          <Link
            key={persona.id}
            href={`/persona/${persona.chain.id}/${persona.id.split('-')[1]}`}
            className="block"
          >
            <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-xl">{persona.name}</h3>
                      <span className="text-gray-500">${persona.symbol}</span>
                      {persona.isGraduated && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                          Graduated
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      on {persona.chain.name} • Created {persona.daysActive} days ago
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    +{(persona.growthMultiplier * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-gray-500">growth</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-gray-500">24h Volume</p>
                  <p className="font-medium">{formatEther(BigInt(persona.totalVolume24h))} AMICA</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">All Time Volume</p>
                  <p className="font-medium">{formatEther(BigInt(persona.totalVolumeAllTime))} AMICA</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">24h Trades</p>
                  <p className="font-medium">{persona.totalTrades24h}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">24h Traders</p>
                  <p className="font-medium">{persona.uniqueTraders24h}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {trending.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No trending personas found</p>
        </div>
      )}
    </Layout>
  );
}
