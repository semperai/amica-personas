import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatEther } from 'viem';
import { fetchPersonas } from '../lib/api';

interface Persona {
  id: string;
  name: string;
  symbol: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  isGraduated: boolean;
  chain: {
    id: string;
    name: string;
  };
}

export function PersonaList() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortBy, setSortBy] = useState('volume24h');

  useEffect(() => {
    const loadPersonas = async () => {
      try {
        setError(false);
        const sortMap: Record<string, string> = {
          volume24h: 'totalVolume24h_DESC',
          volumeAll: 'totalVolumeAllTime_DESC',
          newest: 'createdAt_DESC',
          name: 'name_ASC'
        };

        const data = await fetchPersonas({
          sort: sortMap[sortBy],
          limit: 50
        });
        
        setPersonas(data.personas);
      } catch (error) {
        console.error('Error loading personas:', error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadPersonas();
  }, [sortBy]);

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">All Personas</h2>
          <div className="w-32 h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">All Personas</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 mb-4">Unable to load personas. The API service might be offline.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">All Personas</h2>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="volume24h">24h Volume</option>
          <option value="volumeAll">All Time Volume</option>
          <option value="newest">Newest</option>
          <option value="name">Name</option>
        </select>
      </div>

      {personas.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No personas found. Be the first to create one!</p>
          <Link href="/create" className="inline-block mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
            Create Persona
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((persona) => (
            <Link
              key={persona.id}
              href={`/persona/${persona.chain.id}/${persona.id.split('-')[1]}`}
              className="block"
            >
              <div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-lg">{persona.name}</h3>
                    <p className="text-sm text-gray-500">${persona.symbol}</p>
                  </div>
                  {persona.isGraduated && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                      Graduated
                    </span>
                  )}
                </div>
                
                <div className="text-sm text-gray-600">
                  <p>24h Volume: {formatEther(BigInt(persona.totalVolume24h))} ETH</p>
                  <p>All Time: {formatEther(BigInt(persona.totalVolumeAllTime))} ETH</p>
                  <p className="text-xs mt-1">Chain: {persona.chain.name}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
