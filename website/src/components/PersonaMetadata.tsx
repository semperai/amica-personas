// src/components/PersonaMetadata.tsx
import { useQuery } from '@apollo/client';
import { GET_PERSONA_DETAILS } from '@/lib/graphql/client';
import { formatEther } from 'viem';
import AgentTokenInfo from './AgentTokenInfo';

interface PersonaMetadataProps {
  chainId: string;
  tokenId: string;
}

interface MetadataItem {
  key: string;
  value: string;
}

const PersonaMetadata = ({ chainId, tokenId }: PersonaMetadataProps) => {
  const personaId = `${chainId}-${tokenId}`;
  
  const { data, loading, error } = useQuery(GET_PERSONA_DETAILS, {
    variables: { id: personaId },
    skip: !chainId || !tokenId,
  });

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded w-3/4"></div>
            <div className="h-4 bg-white/10 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.persona) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error?.message || 'Persona not found'}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const persona = data.persona;
  const isGraduated = persona.pairCreated;
  const progress = persona.totalDeposited && persona.graduationThreshold
    ? (Number(persona.totalDeposited) / Number(persona.graduationThreshold)) * 100
    : 0;

  // Extract chain info from ID
  const [extractedChainId] = persona.id.split('-');
  const chainNames: Record<string, string> = {
    '1': 'ethereum',
    '8453': 'base',
    '42161': 'arbitrum'
  };
  const chainName = chainNames[extractedChainId] || 'unknown';

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-light text-white">{persona.name}</h1>
          <p className="text-lg text-white/60">${persona.symbol}</p>
        </div>
        {isGraduated && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400 backdrop-blur-sm">
            Graduated
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-white/50">Creator</p>
          <a
            href={`https://etherscan.io/address/${persona.creator}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 font-mono text-sm"
          >
            {persona.creator.slice(0, 6)}...{persona.creator.slice(-4)}
          </a>
        </div>
        <div>
          <p className="text-sm text-white/50">Chain</p>
          <p className="text-white font-light capitalize">{chainName}</p>
        </div>
        <div>
          <p className="text-sm text-white/50">24h Volume</p>
          <p className="text-white font-light">
            {/* Using totalDeposited as proxy for volume in this example */}
            {formatEther(BigInt(persona.totalDeposited || 0))} AMICA
          </p>
        </div>
        <div>
          <p className="text-sm text-white/50">Total Volume</p>
          <p className="text-white font-light">
            {formatEther(BigInt(persona.totalDeposited || 0))} AMICA
          </p>
        </div>
      </div>

      {!isGraduated && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/60">Graduation Progress</span>
            <span className="text-white font-light">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/50 mt-2">
            {formatEther(BigInt(persona.totalDeposited || 0))} / {formatEther(BigInt(persona.graduationThreshold || 0))} AMICA
          </p>
        </div>
      )}

      {persona.metadata && persona.metadata.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <h3 className="text-sm font-medium text-white mb-3">Metadata</h3>
          <div className="space-y-2">
            {persona.metadata.map((item: MetadataItem) => (
              <div key={item.key} className="flex justify-between text-sm">
                <span className="text-white/50">{item.key}:</span>
                <span className="text-white/80">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Token Info */}
      <AgentTokenInfo
        agentToken={persona.agentToken}
        minAgentTokens={persona.minAgentTokens}
        totalAgentDeposited={persona.totalAgentDeposited}
        isGraduated={isGraduated}
      />
    </div>
  );
};

export default PersonaMetadata;
