import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatEther } from 'viem';
import { fetchTrending } from '../lib/api';
import Layout from '@/components/Layout';

interface TrendingPersona {
  id: string;
  name: string;
  symbol: string;
  totalVolume24h: string;
  growthMultiplier?: number;  // Make growthMultiplier optional
  chain: {
    id: string;
    name: string;
  };
}

export default function TrendingPage() {
  const [trending, setTrending] = useState<TrendingPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadTrending = async () => {
      try {
        setError(false);
        const data = await fetchTrending();
        setTrending(data); // Show all trending personas on this page
      } catch (error) {
        console.error('Error loading trending:', error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadTrending();
  }, []);

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔥 Trending Personas</h1>
        <p className="text-gray-600">Discover the hottest personas with the highest growth in the last 24 hours</p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Unable to load trending personas. The API might be offline.</p>
        </div>
      )}

      {!loading && !error && trending.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No trending personas at the moment. Check back later!</p>
        </div>
      )}

      {!loading && !error && trending.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trending.map((persona, index) => (
            <Link
              key={persona.id}
              href={`/persona/${persona.chain.id}/${persona.id.split('-')[1]}`}
              className="block"
            >
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-[1px] rounded-lg">
                <div className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">#{index + 1}</span>
                        <h3 className="font-semibold">{persona.name}</h3>
                      </div>
                      <p className="text-sm text-gray-500">${persona.symbol}</p>
                    </div>
                    {persona.growthMultiplier !== undefined && persona.growthMultiplier > 0 && (
                      <span className="text-green-600 font-bold text-lg">
                        +{Math.round(persona.growthMultiplier * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      24h Volume: {formatEther(BigInt(persona.totalVolume24h))} ETH
                    </p>
                    <p className="text-xs text-gray-500">
                      Chain: {persona.chain.name}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
