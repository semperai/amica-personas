import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { fetchPersonas } from '@/lib/api';
import { formatEther } from 'viem';
import Link from 'next/link';

interface Persona {
  id: string;
  name: string;
  symbol: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  totalDeposited: string;
  isGraduated: boolean;
  chain: {
    id: string;
    name: string;
  };
}

// Generate a unique gradient background for each persona based on its ID
const getPersonaGradient = (id: string) => {
  const gradients = [
    'from-purple-600 to-pink-600',
    'from-blue-600 to-cyan-500',
    'from-indigo-600 to-purple-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-blue-600',
    'from-violet-600 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-blue-500 to-indigo-600',
  ];

  const index = parseInt(id.split('-')[1] || '0') % gradients.length;
  return gradients[index];
};

export default function HomePage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('volume');

  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const sortMap: Record<string, string> = {
          volume: 'totalVolume24h_DESC',
          tvl: 'totalDeposited_DESC',
          new: 'createdAt_DESC'
        };

        const data = await fetchPersonas({
          sort: sortMap[sortBy],
          limit: 50
        });

        setPersonas(data.personas);
      } catch (error) {
        console.error('Error loading personas:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPersonas();
  }, [sortBy]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Sort Dropdown - positioned at the top right */}
        <div className="flex justify-end mb-8">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white/10 backdrop-blur-sm text-white px-6 py-2 pr-10 rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
            >
              <option value="volume" className="bg-slate-800">Volume</option>
              <option value="tvl" className="bg-slate-800">TVL</option>
              <option value="new" className="bg-slate-800">New</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

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
              <Link
                key={persona.id}
                href={`/persona/${persona.chain.id}/${persona.id.split('-')[1]}`}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${getPersonaGradient(persona.id)} opacity-80`} />

                {/* Glass overlay */}
                <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />

                {/* Content */}
                <div className="relative h-full p-5 flex flex-col justify-between">
                  {/* Top Section */}
                  <div>
                    {persona.isGraduated && (
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm mb-3">
                        <span className="text-xs font-medium text-white">Graduated</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Section */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1 line-clamp-1">
                        {persona.name}
                      </h3>
                      <p className="text-sm text-white/70">${persona.symbol}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-white/60">24h Vol</span>
                        <span className="text-sm font-medium text-white">
                          {parseFloat(formatEther(BigInt(persona.totalVolume24h))).toFixed(2)} Ξ
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-white/60">TVL</span>
                        <span className="text-sm font-medium text-white">
                          {parseFloat(formatEther(BigInt(persona.totalDeposited || '0'))).toFixed(2)} Ξ
                        </span>
                      </div>
                    </div>

                    {/* Chain indicator */}
                    <div className="pt-2 border-t border-white/20">
                      <span className="text-xs text-white/60 capitalize">{persona.chain.name}</span>
                    </div>
                  </div>
                </div>

                {/* Hover effect overlay */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
              </Link>
            ))}
          </div>
        )}

        {!loading && personas.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <p className="text-white/60 text-lg">No personas found</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
