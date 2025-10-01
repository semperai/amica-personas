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
    <div id="explore" className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16">
      {/* Section Header */}
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Explore Personas</h2>
        <p className="text-muted-foreground">Discover and trade AI personas on the bonding curve</p>
      </div>

      {/* Enhanced Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none bg-card text-foreground px-6 py-2 pr-10 rounded-lg border border-border focus:outline-none focus:border-brand-blue transition-colors cursor-pointer"
          >
            <option value="trending">Trending</option>
            <option value="volume">24h Volume</option>
            <option value="tvl">TVL</option>
            <option value="new">Newest</option>
            <option value="graduated">All Time Volume</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 mb-8">
          <p className="text-destructive text-center">{error}</p>
        </div>
      )}

      {/* Personas Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {personas.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} />
          ))}
        </div>
      )}

      {!loading && personas.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground text-lg mb-4">No personas found for the selected filter</p>
          <button
            onClick={() => {
              setFilterBy('all');
              setSortBy('trending');
            }}
            className="px-6 py-2 bg-brand-blue/20 text-brand-blue rounded-lg hover:bg-brand-blue/30 transition-colors font-medium"
          >
            Show All Personas
          </button>
        </div>
      )}
    </div>
  );
}
