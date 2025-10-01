'use client';

import { useState, useEffect } from 'react';
import { fetchPersonas } from '@/lib/api-graphql';
import PersonaCard from './PersonaCard';

interface Persona {
  id: string;
  name: string;
  symbol: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  totalDeposited?: string;
  isGraduated: boolean;
  hasAgentToken: boolean;
  canGraduate?: boolean;
  agentTokenProgress?: number;
  chain: {
    id: string;
    name: string;
  };
  growthMultiplier?: number;
  createdAt?: string;
}

export default function PersonaGrid() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('trending');
  const [filterBy, setFilterBy] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        setLoading(true);
        const sortMap: Record<string, string> = {
          trending: 'totalDeposited_DESC',
          volume: 'totalDeposited_DESC',
          tvl: 'totalDeposited_DESC',
          new: 'createdAt_DESC',
          graduated: 'totalDeposited_DESC'
        };

        try {
          const data = await fetchPersonas({
            sort: sortMap[sortBy],
            limit: 50,
          });

          setPersonas(data.personas);
        } catch (personasError) {
          console.error('Failed to load personas:', personasError);
          setError('Unable to load personas. Please try again later.');
          setPersonas([]);
        }
      } catch (error) {
        console.error('Unexpected error loading data:', error);
        setError('An unexpected error occurred. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sortBy, filterBy]);

  return (
    <div id="explore" className="max-w-7xl mx-auto px-6 py-8">
      {/* Enhanced Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none bg-white/10 backdrop-blur-sm text-white px-6 py-2 pr-10 rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
          >
            <option value="trending" className="bg-slate-800">Trending</option>
            <option value="volume" className="bg-slate-800">24h Volume</option>
            <option value="tvl" className="bg-slate-800">TVL</option>
            <option value="new" className="bg-slate-800">Newest</option>
            <option value="graduated" className="bg-slate-800">All Time Volume</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-lg p-6 mb-8">
          <p className="text-red-400 text-center">{error}</p>
        </div>
      )}

      {/* Personas Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-white/5 backdrop-blur-sm rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {personas.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} />
          ))}
        </div>
      )}

      {!loading && personas.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-white/60 text-lg mb-4">No personas found for the selected filter</p>
          <button
            onClick={() => {
              setFilterBy('all');
              setSortBy('trending');
            }}
            className="px-6 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
          >
            Show All Personas
          </button>
        </div>
      )}
    </div>
  );
}
