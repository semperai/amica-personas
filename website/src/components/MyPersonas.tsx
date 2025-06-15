import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchUserPortfolio } from '../lib/api';
import { formatEther } from 'viem';

interface MyPersonasProps {
  address: string;
}

interface CreatedPersona {
  id: string;
  name: string;
  symbol: string;
  totalVolumeAllTime: string;
  isGraduated: boolean;
  chain: {
    id: string;
    name: string;
  };
}

// Generate gradient for persona cards
const getPersonaGradient = (id: string) => {
  const gradients = [
    'from-purple-600 to-pink-600',
    'from-blue-600 to-cyan-500',
    'from-indigo-600 to-purple-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-blue-600',
  ];

  const index = parseInt(id.split('-')[1] || '0') % gradients.length;
  return gradients[index];
};

export function MyPersonas({ address }: MyPersonasProps) {
  const [personas, setPersonas] = useState<CreatedPersona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        const data = await fetchUserPortfolio(address);
        setPersonas(data.createdPersonas);
      } catch (error) {
        console.error('Error loading portfolio:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPortfolio();
  }, [address]);

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">My Created Personas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">My Created Personas</h2>
        <div className="text-center py-12">
          <p className="text-white/60 mb-6">You haven&apos;t created any personas yet.</p>
          <Link
            href="/create"
            className="inline-block bg-white/10 backdrop-blur-md text-white px-8 py-3 rounded-full hover:bg-white/20 transition-all duration-300"
          >
            Create Your First Persona
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-light text-white mb-6">My Created Personas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.map((persona) => (
          <Link
            key={persona.id}
            href={`/persona/${persona.chain.id}/${persona.id.split('-')[1]}`}
            className="group relative h-48 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${getPersonaGradient(persona.id)} opacity-80`} />

            {/* Glass overlay */}
            <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />

            {/* Content */}
            <div className="relative h-full p-6 flex flex-col justify-between">
              <div>
                {persona.isGraduated && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm text-white">
                    Graduated
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-1">{persona.name}</h3>
                <p className="text-sm text-white/70 mb-3">${persona.symbol}</p>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">Total Volume</span>
                  <span className="text-sm font-medium text-white">
                    {formatEther(BigInt(persona.totalVolumeAllTime))} ETH
                  </span>
                </div>

                <p className="text-xs text-white/60 mt-2 capitalize">
                  {persona.chain.name}
                </p>
              </div>
            </div>

            {/* Hover effect overlay */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
