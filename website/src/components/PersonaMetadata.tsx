import { useEffect, useState } from 'react';
import { fetchPersonaDetail } from '@/lib/api';
import { formatEther } from 'viem';

interface PersonaMetadataProps {
  chainId: string;
  tokenId: string;
}

interface MetadataItem {
  key: string;
  value: string;
}

interface PersonaData {
  id: string;
  tokenId: string;
  name: string;
  symbol: string;
  creator: string;
  erc20Token: string;
  pairToken: string;
  pairCreated: boolean;
  pairAddress?: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  totalTrades24h: number;
  totalTradesAllTime: number;
  uniqueTraders24h: number;
  uniqueTradersAllTime: number;
  totalDeposited: string;
  tokensSold: string;
  graduationThreshold: string;
  isGraduated: boolean;
  createdAt: string;
  chain: {
    id: string;
    name: string;
  };
  metadata?: MetadataItem[];
}

const PersonaMetadata = ({ chainId, tokenId }: PersonaMetadataProps) => {
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPersona = async () => {
      try {
        setError(null);
        const data = await fetchPersonaDetail(chainId, tokenId);
        setPersona(data);
      } catch (error) {
        console.error('Failed to load persona:', error);
        setError('Failed to load persona details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadPersona();
  }, [chainId, tokenId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !persona) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Persona not found'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const progress = persona.totalDeposited && persona.graduationThreshold
    ? (Number(persona.totalDeposited) / Number(persona.graduationThreshold)) * 100
    : 0;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{persona.name}</h1>
          <p className="text-lg text-gray-600">${persona.symbol}</p>
        </div>
        {persona.isGraduated && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Graduated
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500">Creator</p>
          <a 
            href={`https://etherscan.io/address/${persona.creator}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:text-purple-700 font-mono text-sm"
          >
            {persona.creator.slice(0, 6)}...{persona.creator.slice(-4)}
          </a>
        </div>
        <div>
          <p className="text-sm text-gray-500">Chain</p>
          <p className="text-gray-900 font-medium capitalize">{persona.chain?.name || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">24h Volume</p>
          <p className="text-gray-900 font-medium">
            {formatEther(BigInt(persona.totalVolume24h || 0))} AMICA
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total Volume</p>
          <p className="text-gray-900 font-medium">
            {formatEther(BigInt(persona.totalVolumeAllTime || 0))} AMICA
          </p>
        </div>
      </div>

      {!persona.isGraduated && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Graduation Progress</span>
            <span className="text-gray-900 font-medium">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {formatEther(BigInt(persona.totalDeposited || 0))} / {formatEther(BigInt(persona.graduationThreshold || 0))} AMICA
          </p>
        </div>
      )}

      {persona.metadata && persona.metadata.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Metadata</h3>
          <div className="space-y-2">
            {persona.metadata.map((item: MetadataItem) => (
              <div key={item.key} className="flex justify-between text-sm">
                <span className="text-gray-500">{item.key}:</span>
                <span className="text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonaMetadata;
