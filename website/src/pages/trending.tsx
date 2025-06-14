import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatEther } from 'viem';
import { fetchTrending } from '../lib/api';

interface TrendingPersona {
  id: string;
  name: string;
  symbol: string;
  totalVolume24h: string;
  growthMultiplier: number;
  chain: {
    id: string;
    name: string;
  };
}

export default function TrendingPersonasPage() {
  const [trending, setTrending] = useState<TrendingPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadTrending = async () => {
      try {
        setError(false);
        const data = await fetchTrending();
        setTrending(data.slice(0, 6)); // Top 6 trending
      } catch (error) {
        console.error('Error loading trending:', error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadTrending();
  }, []);

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">🔥 Trending Now</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">🔥 Trending Now</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Unable to load trending personas. The API might be offline.</p>
        </div>
      </div>
    );
  }

  if (trending.length === 0) {
    return null; // Don't show the section if no trending data
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4">🔥 Trending Now</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trending.map((persona) => (
          <Link
            key={persona.id}
            href={`/persona/${persona.chain.id}/${persona.id.split('-')[1]}`}
            className="block"
          >
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-[1px] rounded-lg">
              <div className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{persona.name}</h3>
                  <span className="text-green-600 font-bold">
                    +{Math.round(persona.growthMultiplier * 100)}%
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  24h: {formatEther(BigInt(persona.totalVolume24h))} ETH
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {persona.chain.name}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
