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

  if (loading) return <div>Loading your personas...</div>;

  if (personas.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">You haven&apos;t created any personas yet.</p>
        <Link href="/create" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Create Your First Persona
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4">My Created Personas</h2>
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
                  <h3 className="font-semibold">{persona.name}</h3>
                  <p className="text-sm text-gray-500">${persona.symbol}</p>
                </div>
                {persona.isGraduated && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    Graduated
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Volume: {formatEther(BigInt(persona.totalVolumeAllTime))} ETH
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Chain: {persona.chain.name}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
